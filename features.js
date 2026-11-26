/* ══════════════════════════════════════════════════════════════════════════
   SAISONOVO – ERWEITERUNGEN
   Kochbuch · Punkte & Gamification (Level, Serien, Abzeichen) · Wirkung
   (Nachhaltigkeitszahlen) · Anbindung an den Scanner

   Wird NACH app.js geladen und nutzt dessen globale Funktionen und Daten
   (_saisondaten, _matchSaisondatenByName, _calculateSaisonScore,
   _getFootprintData, _showToast, …). app.js ruft an wenigen Stellen Hooks auf
   (gmInitTab, gmOnScan, gmOnPurchase, gmAfterScoreChange) – alle sind mit
   typeof-Prüfung abgesichert, damit die App auch ohne diese Datei läuft.

   Neue localStorage-Keys:
     gruenkorb-gamification   Scans, Gekochtes, Serie, Abzeichen, Punkte-Log
     gruenkorb-scan-history   Letzte Scans (für Saisonquote & Abzeichen)
     gruenkorb-kochbuch       Favoriten + eigene (importierte) Rezepte
   ══════════════════════════════════════════════════════════════════════════ */

/* ───────────── Allgemeine Helfer ───────────── */

function _gmEsc(v) {
  return typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '');
}

function _gmFmt(n, decimals = 1) {
  return Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function _gmToday(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _gmYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return _gmToday(d);
}

const _GM_MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const _GM_MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/* Toast-Warteschlange: app.js ersetzt bei jedem _showToast() den vorherigen Toast sofort.
   Mehrere Meldungen direkt hintereinander (z. B. "+5 Punkte" und "Neues Abzeichen")
   würden sich dadurch gegenseitig verschlucken – hier werden sie nacheinander gezeigt. */
(function _gmInstallToastQueue() {
  if (typeof _showToast !== 'function') return;
  const original = _showToast;
  const queue = [];
  let busy = false;
  const next = () => {
    if (!queue.length) { busy = false; return; }
    busy = true;
    original(queue.shift());
    setTimeout(next, 2600);
  };
  window._showToast = function (msg) {
    queue.push(msg);
    if (!busy) next();
  };
})();

/* ───────────── Speicher ───────────── */

const GM_KEY = 'gruenkorb-gamification';
const GM_SCAN_HISTORY_KEY = 'gruenkorb-scan-history';
const KB_KEY = 'gruenkorb-kochbuch';

function gmLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(GM_KEY) || '{}'); } catch (e) { s = {}; }
  s.scans = Object.assign({ count: 0, seasonal: 0, bio: 0, daily: { date: '', keys: [], pts: 0 } }, s.scans);
  s.cooked = Object.assign({ count: 0, seasonal: 0, log: [] }, s.cooked);
  if (!s.cooked.monthly) {
    // Gekochte Gerichte pro Monat ("2026-11": 12) – für die Monatsabzeichen.
    s.cooked.monthly = {};
    for (const l of s.cooked.log) { const m = (l.d || '').slice(0, 7); if (m) s.cooked.monthly[m] = (s.cooked.monthly[m] || 0) + 1; }
  }
  s.streak = Object.assign({ last: '', count: 0, best: 0, claimed: [] }, s.streak);
  s.badges = s.badges || {};
  s.pointsLog = s.pointsLog || [];
  s.purchaseBonus = s.purchaseBonus || 0;
  if (s.lastLevel == null) s.lastLevel = null;
  return s;
}

function gmSave(s) {
  localStorage.setItem(GM_KEY, JSON.stringify(s));
}

function gmLoadScore() {
  try {
    return Object.assign({ total: 0, swaps: 0, purchases: 0, challengesCompleted: 0 },
      JSON.parse(localStorage.getItem('gruenkorb-score') || '{}'));
  } catch (e) {
    return { total: 0, swaps: 0, purchases: 0, challengesCompleted: 0 };
  }
}

// Zentrale Stelle für neue Punkte (Scans, Kochen, Einkäufe, Serien). Punkte aus app.js
// (Alternativen, Challenges, Ernährungsbonus) landen weiterhin direkt in gruenkorb-score.total –
// Level und Abzeichen werden immer aus diesem Gesamtwert berechnet, egal woher die Punkte kommen.
function gmAddPoints(pts, grund, gmState) {
  if (!pts) return;
  const score = gmLoadScore();
  score.total = (score.total || 0) + pts;
  localStorage.setItem('gruenkorb-score', JSON.stringify(score));
  const s = gmState || gmLoad();
  s.pointsLog.unshift({ t: Date.now(), pts, grund });
  s.pointsLog = s.pointsLog.slice(0, 50);
  if (!gmState) gmSave(s);
}

/* ───────────── Level ───────────── */

const GM_LEVELS = [
  { min: 0,    name: 'Samenkorn',          icon: '🌰' },
  { min: 30,   name: 'Keimling',           icon: '🌱' },
  { min: 80,   name: 'Sprössling',         icon: '🌿' },
  { min: 160,  name: 'Jungpflanze',        icon: '🪴' },
  { min: 300,  name: 'Blütezeit',          icon: '🌼' },
  { min: 500,  name: 'Erntezeit',          icon: '🧺' },
  { min: 800,  name: 'Saisonprofi',        icon: '🍎' },
  { min: 1200, name: 'Klimagärtner:in',    icon: '🌳' },
  { min: 1800, name: 'Saisonovo-Legende',  icon: '🏆' },
];

function gmLevelInfo(total) {
  let idx = 0;
  GM_LEVELS.forEach((l, i) => { if (total >= l.min) idx = i; });
  const level = GM_LEVELS[idx];
  const next = GM_LEVELS[idx + 1] || null;
  const pct = next ? Math.round((total - level.min) / (next.min - level.min) * 100) : 100;
  return { nummer: idx + 1, ...level, next, pct, fehlend: next ? next.min - total : 0 };
}

/* ───────────── Serie (Tage in Folge aktiv) ───────────── */

const GM_STREAK_BONI = [
  { tage: 3,  pts: 5 },
  { tage: 7,  pts: 15 },
  { tage: 14, pts: 25 },
  { tage: 30, pts: 50 },
];

// Aktiv = gescannt, gekocht, Einkauf abgeschlossen oder Alternative gewählt.
function gmRecordActivity(s) {
  const own = !s;
  s = s || gmLoad();
  const today = _gmToday();
  if (s.streak.last === today) { if (own) gmSave(s); return s; }
  if (s.streak.last === _gmYesterday()) {
    s.streak.count += 1;
  } else {
    s.streak.count = 1;
    s.streak.claimed = [];
  }
  s.streak.last = today;
  s.streak.best = Math.max(s.streak.best || 0, s.streak.count);

  for (const bonus of GM_STREAK_BONI) {
    if (s.streak.count >= bonus.tage && !s.streak.claimed.includes(bonus.tage)) {
      s.streak.claimed.push(bonus.tage);
      gmAddPoints(bonus.pts, `${bonus.tage} Tage in Folge aktiv`, s);
      _showToast(`🔥 ${bonus.tage} Tage in Folge! +${bonus.pts} Punkte`);
    }
  }
  if (own) gmSave(s);
  return s;
}

// Aktuelle Serie für die Anzeige: verfällt, wenn gestern und heute nichts passiert ist.
function gmCurrentStreak(s) {
  s = s || gmLoad();
  if (s.streak.last === _gmToday() || s.streak.last === _gmYesterday()) return s.streak.count;
  return 0;
}

/* ───────────── Abzeichen ───────────── */

const GM_BADGES = [
  { id: 'scan-1', kurz: '1 Produkt scannen',      icon: '📷', titel: 'Erster Scan',        text: 'Scanne dein erstes Produkt.',                         wert: st => st.scans,          ziel: 1 },
  { id: 'scan-25', kurz: '25 Produkte scannen',     icon: '🔍', titel: 'Scanner-Profi',      text: 'Scanne 25 verschiedene Produkte.',                     wert: st => st.scans,          ziel: 25 },
  { id: 'scan-100', kurz: '100 Produkte scannen',    icon: '🛰️', titel: 'Scan-Meister:in',    text: 'Scanne 100 verschiedene Produkte.',                    wert: st => st.scans,          ziel: 100 },
  { id: 'scan-saison', kurz: '10 Saisonfunde scannen', icon: '🟢', titel: 'Saison-Spürnase',    text: 'Finde per Scan 10 Produkte, die gerade Saison haben.', wert: st => st.scansSaison,    ziel: 10 },
  { id: 'scan-bio', kurz: 'Bio-Code scannen',    icon: '🌿', titel: 'Bio-Entdecker:in',   text: 'Scanne einen Bio-PLU-Code (5-stellig, beginnt mit 9).', wert: st => st.scansBio,      ziel: 1 },
  { id: 'cook-1', kurz: '1 Rezept kochen',      icon: '🍳', titel: 'Erstes Gericht',     text: 'Koche ein Rezept aus dem Kochbuch.',                   wert: st => st.gekocht,        ziel: 1 },
  { id: 'cook-10', kurz: '10 Rezepte kochen',     icon: '👩‍🍳', titel: 'Hobbyköch:in',       text: 'Koche 10 Rezepte aus dem Kochbuch.',                   wert: st => st.gekocht,        ziel: 10 },
  { id: 'cook-saison', kurz: '5 Saisonrezepte kochen', icon: '📅', titel: 'Saisonküche',        text: 'Koche 5 Rezepte, die gerade voll in Saison sind.',     wert: st => st.gekochtSaison,  ziel: 5 },
  { id: 'buy-1', kurz: '1. Einkauf abschließen',       icon: '🛍️', titel: 'Erster Einkauf',     text: 'Schließe deinen ersten Einkauf in der App ab.',        wert: st => st.einkaeufe,      ziel: 1 },
  { id: 'swap-10', kurz: '10 Alternativen wählen',     icon: '♻️', titel: 'Tausch-Talent',      text: 'Wähle 10-mal eine pflanzliche Alternative.',           wert: st => st.alternativen,   ziel: 10 },
  { id: 'streak-3', kurz: '3 Tage in Folge aktiv',    icon: '🔥', titel: 'Dranbleiber:in',     text: 'Sei 3 Tage in Folge aktiv.',                           wert: st => st.besteSerie,     ziel: 3 },
  { id: 'streak-7', kurz: '7 Tage in Folge aktiv',    icon: '⚡', titel: 'Wochenflamme',       text: 'Sei 7 Tage in Folge aktiv.',                           wert: st => st.besteSerie,     ziel: 7 },
  { id: 'streak-30', kurz: '30 Tage in Folge aktiv',   icon: '🌟', titel: 'Monatsflamme',       text: 'Sei 30 Tage in Folge aktiv.',                          wert: st => st.besteSerie,     ziel: 30 },
  { id: 'challenge-1', kurz: '1 Challenge schaffen', icon: '🏆', titel: 'Challenge geschafft', text: 'Schließe deine erste Challenge ab.',                   wert: st => st.challenges,     ziel: 1 },
  { id: 'co2-10', kurz: '10 kg CO₂ sparen',      icon: '🌍', titel: 'Klimaschützer:in',   text: 'Spare 10 kg CO₂ gegenüber dem Ø-Einkauf.',             wert: st => st.co2Gespart,     ziel: 10 },
];

// Monatsabzeichen: 20 nachhaltige Gerichte aus dem Kochbuch in einem Monat
// (alle Kochbuch-Rezepte sind vegetarisch/vegan und saisonal bewertet).
const GM_MONAT_ZIEL = 20;
const GM_MONAT_ICONS = ['🥬', '🥕', '🌱', '🌿', '🍓', '🍒', '🫐', '🍅', '🍎', '🎃', '🍄', '🌰'];

function gmMonthBadges(year) {
  const y = year || new Date().getFullYear();
  const jetzt = new Date();
  return _GM_MONATE.map((name, i) => {
    const key = `${y}-${String(i + 1).padStart(2, '0')}`;
    return {
      id: `monat-${key}`, monat: key, icon: GM_MONAT_ICONS[i],
      titel: `${name}-Held:in`,
      kurz: `${GM_MONAT_ZIEL} Gerichte im ${name}`,
      text: `Koche im ${name} ${y} ${GM_MONAT_ZIEL} nachhaltige Gerichte aus dem Kochbuch.`,
      zukunft: y > jetzt.getFullYear() || (y === jetzt.getFullYear() && i > jetzt.getMonth()),
      vorbei: y < jetzt.getFullYear() || (y === jetzt.getFullYear() && i < jetzt.getMonth()),
      wert: st => (st.monate && st.monate[key]) || 0,
      ziel: GM_MONAT_ZIEL,
    };
  });
}

function gmAllBadges() {
  return [...GM_BADGES, ...gmMonthBadges()];
}

function gmStats() {
  const s = gmLoad();
  const score = gmLoadScore();
  const impact = gmImpact();
  return {
    scans: s.scans.count,
    scansSaison: s.scans.seasonal,
    scansBio: s.scans.bio,
    gekocht: s.cooked.count,
    gekochtSaison: s.cooked.seasonal,
    monate: s.cooked.monthly || {},
    einkaeufe: score.purchases || 0,
    alternativen: score.swaps || 0,
    challenges: score.challengesCompleted || 0,
    besteSerie: s.streak.best || 0,
    co2Gespart: Math.max(0, impact.co2Gespart),
    punkte: score.total || 0,
  };
}

// Prüft nach jeder Aktion, ob ein neues Level oder Abzeichen erreicht wurde, und meldet es.
function gmCheckProgress() {
  const s = gmLoad();
  const st = gmStats();
  const lvl = gmLevelInfo(st.punkte);
  let changed = false;

  if (s.lastLevel == null) {
    s.lastLevel = lvl.nummer; // erster Start: aktuelles Level übernehmen, ohne zu feiern
    changed = true;
  } else if (lvl.nummer > s.lastLevel) {
    s.lastLevel = lvl.nummer;
    changed = true;
    _showToast(`${lvl.icon} Level ${lvl.nummer}: ${lvl.name}!`);
  }

  for (const b of gmAllBadges()) {
    if (!s.badges[b.id] && b.wert(st) >= b.ziel) {
      s.badges[b.id] = new Date().toISOString();
      changed = true;
      _showToast(`${b.icon} Neues Abzeichen: ${b.titel}`);
    }
  }
  if (changed) gmSave(s);
}

function gmAfterScoreChange() {
  try { gmCheckProgress(); } catch (e) { console.warn('Gamification:', e); }
}

/* ───────────── Wirkung (Nachhaltigkeitszahlen) ───────────── */

// Vergleichsbasis: Ø-Fußabdruck pro kg Lebensmittel in Deutschland – dieselben Werte, die
// app.js bereits für nicht erkannte Artikel nutzt (FOOTPRINT_BASELINE_WEEKLY /
// AVERAGE_WEEKLY_FOOD_KG: 1.700 kg CO₂ bei ~975 kg Lebensmitteln pro Kopf und Jahr).
// "Gespart" = was derselbe Einkauf (gleiches Gewicht) im Ø gekostet hätte − tatsächlicher Wert.
// Nicht erkannte Artikel werden in app.js mit genau diesem Ø bewertet und sind damit neutral.
function _gmBaselinePerKg() {
  if (typeof FOOTPRINT_BASELINE_WEEKLY === 'undefined' || typeof AVERAGE_WEEKLY_FOOD_KG === 'undefined') {
    return { co2: 1700 / 975, wasser: 3761 * 365 / 975, land: 2022 / 975 };
  }
  return {
    co2: FOOTPRINT_BASELINE_WEEKLY.co2 / AVERAGE_WEEKLY_FOOD_KG,
    wasser: FOOTPRINT_BASELINE_WEEKLY.wasser / AVERAGE_WEEKLY_FOOD_KG,
    land: FOOTPRINT_BASELINE_WEEKLY.land / AVERAGE_WEEKLY_FOOD_KG,
  };
}

// Umrechnungsgrößen für die Anschaulichkeit (Quellen siehe Info-Bereich in der Wirkungskarte)
const GM_PKW_KG_CO2_PRO_KM = 0.164;   // Umweltbundesamt, Pkw 2023: 164 g CO₂e pro Personenkilometer
const GM_BUCHE_KG_CO2_PRO_JAHR = 12.5; // Wald-Zentrum Uni Münster: Ø-Buche bindet ~12,5 kg CO₂/Jahr

function _gmSwapSavingKg(ecoSwap) {
  if (!ecoSwap || typeof _getErnProduktById !== 'function') return 0;
  const from = _getErnProduktById(ecoSwap.fromErnId);
  if (!from?.umwelt) return 0;
  const kg = from.portion_kg || 0.25;
  const toName = (ecoSwap.to || '').toLowerCase();
  const vergleich = (from.umwelt_vergleich || []).find(v => v.name.toLowerCase() === toName);
  let toCo2 = vergleich?.co2_kg;
  if (toCo2 == null && typeof _getFootprintData === 'function') toCo2 = _getFootprintData(ecoSwap.to)?.co2_kg;
  if (toCo2 == null) return 0; // ohne belastbaren Vergleichswert lieber nichts behaupten
  return Math.max(0, (from.umwelt.co2_kg - toCo2) * kg);
}

function gmImpact() {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('gruenkorb-einkauf-history') || '[]'); } catch (e) { history = []; }
  const base = _gmBaselinePerKg();
  const now = new Date();
  const monate = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monate.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: _GM_MONATE_KURZ[d.getMonth()], co2: 0 });
  }

  const res = {
    co2Gespart: 0, wasserGespart: 0, co2Monat: 0, co2Gesamt: 0, kgGesamt: 0,
    einkaeufe: 0, saisonArtikel: 0, ampelArtikel: 0, alternativen: 0, co2Alternativen: 0,
    monate,
  };

  for (const h of history) {
    if (!h.footprint) continue;
    const fp = h.footprint;
    const co2 = (fp.kg || 0) * base.co2 - (fp.co2 || 0);
    const wasser = (fp.kg || 0) * base.wasser - (fp.wasser || 0);
    res.co2Gespart += co2;
    res.wasserGespart += wasser;
    res.co2Gesamt += fp.co2 || 0;
    res.kgGesamt += fp.kg || 0;
    res.einkaeufe += 1;
    const d = new Date(h.datum);
    const bucket = monate.find(m => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.co2 += co2;
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) res.co2Monat += co2;
    for (const it of (h.items || [])) {
      if (it.ampel) { res.ampelArtikel += 1; if (it.ampel === 'gruen') res.saisonArtikel += 1; }
      if (it.ecoSwap) { res.alternativen += 1; res.co2Alternativen += _gmSwapSavingKg(it.ecoSwap); }
    }
  }

  // Scans fließen nur in die Saisonquote ein (ein Scan ist noch kein Kauf, daher kein CO₂-Wert)
  let scans = [];
  try { scans = JSON.parse(localStorage.getItem(GM_SCAN_HISTORY_KEY) || '[]'); } catch (e) { scans = []; }
  res.scansMitAmpel = scans.filter(x => x.ampel).length;
  res.scansSaison = scans.filter(x => x.ampel === 'gruen').length;

  const ampelGesamt = res.ampelArtikel + res.scansMitAmpel;
  res.saisonquote = ampelGesamt ? Math.round((res.saisonArtikel + res.scansSaison) / ampelGesamt * 100) : null;
  res.autoKm = res.co2Gespart / GM_PKW_KG_CO2_PRO_KM;
  res.buchenTage = res.co2Gespart / GM_BUCHE_KG_CO2_PRO_JAHR * 365;
  return res;
}

/* ───────────── Rendering: Home ───────────── */

function gmRenderHomeStrip() {
  const el = document.getElementById('gm-home-strip');
  if (!el) return;
  const score = gmLoadScore();
  const lvl = gmLevelInfo(score.total || 0);
  const streak = gmCurrentStreak();
  const impact = gmImpact();
  const co2 = impact.einkaeufe
    ? `${impact.co2Gespart >= 0 ? '' : '+'}${_gmFmt(Math.abs(impact.co2Gespart))} kg`
    : '–';
  el.innerHTML = `
    <button class="gm-chip" onclick="showScreen('profile')" aria-label="Level ${lvl.nummer}, ${score.total || 0} Punkte">
      <span class="gm-chip-icon">${lvl.icon}</span>
      <span class="gm-chip-text"><strong>Lvl ${lvl.nummer}</strong><small>${score.total || 0} Pkt.</small></span>
    </button>
    <button class="gm-chip${streak ? ' gm-chip--fire' : ''}" onclick="showScreen('profile')" aria-label="Serie: ${streak} Tage">
      <span class="gm-chip-icon">🔥</span>
      <span class="gm-chip-text"><strong>${streak} ${streak === 1 ? 'Tag' : 'Tage'}</strong><small>Serie</small></span>
    </button>
    <button class="gm-chip${impact.co2Gespart < 0 ? ' gm-chip--bad' : ''}" onclick="gmOpenImpactSheet()" aria-label="CO₂-Wirkung">
      <span class="gm-chip-icon">🌍</span>
      <span class="gm-chip-text"><strong>${co2}</strong><small>${impact.co2Gespart < 0 ? 'CO₂ über Ø' : 'CO₂ gespart'}</small></span>
    </button>`;
}

/* ───────────── Rendering: Profil ───────────── */

const GM_BADGE_GRUPPEN = [
  { key: 'scan',  titel: 'Scannen',        ids: ['scan-1', 'scan-25', 'scan-100', 'scan-saison', 'scan-bio'] },
  { key: 'cook',  titel: 'Kochen',         ids: ['cook-1', 'cook-10', 'cook-saison'] },
  { key: 'buy',   titel: 'Einkaufen',      ids: ['buy-1', 'swap-10', 'co2-10'] },
  { key: 'serie', titel: 'Dranbleiben',    ids: ['streak-3', 'streak-7', 'streak-30', 'challenge-1'] },
];

function gmRenderProfile() {
  const s = gmLoad();
  const score = gmLoadScore();
  const lvl = gmLevelInfo(score.total || 0);
  const streak = gmCurrentStreak(s);
  const st = gmStats();
  const earnedCount = Object.keys(s.badges).length;

  // Untertitel wie bei Duolingo: "Dabei seit …"
  const sub = document.getElementById('profile-subtitle');
  if (sub) {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem('gruenkorb-profile') || '{}'); } catch (e) { profile = {}; }
    const seit = profile.onboardingDate ? new Date(profile.onboardingDate) : null;
    sub.textContent = seit
      ? `Dabei seit ${_GM_MONATE[seit.getMonth()]} ${seit.getFullYear()} · ${profile.region || 'Deutschland'}`
      : (profile.region || 'Deutschland');
  }

  const avatarLvl = document.getElementById('pf-avatar-level');
  if (avatarLvl) avatarLvl.innerHTML = `<span>${lvl.icon}</span>`;

  // Level (groß)
  const headEl = document.getElementById('gm-level-head');
  if (headEl) {
    headEl.innerHTML = `
      <div class="pf-level-kicker">Level ${lvl.nummer}</div>
      <div class="pf-level-title">${lvl.icon} ${lvl.name}</div>`;
  }

  // Level-Details
  const levelEl = document.getElementById('gm-level-card');
  if (levelEl) {
    const log = s.pointsLog.slice(0, 3).map(p =>
      `<div class="gm-log-row"><span>${_gmEsc(p.grund)}</span><span class="gm-log-pts">+${p.pts}</span></div>`).join('');
    const stufen = GM_LEVELS.map((l, i) => `
      <span class="gm-stufe${i + 1 < lvl.nummer ? ' done' : i + 1 === lvl.nummer ? ' current' : ''}" title="Level ${i + 1}: ${l.name} (ab ${l.min} Punkten)">${l.icon}</span>`).join('');
    levelEl.innerHTML = `
      <div class="g9 gm-level-numbers">
        <div class="span-3 gm-level-num"><strong>${score.total || 0}</strong><small>Punkte</small></div>
        <div class="span-3 gm-level-num"><strong>🔥 ${streak}</strong><small>Tage in Folge</small></div>
        <div class="span-3 gm-level-num"><strong>🏅 ${s.streak.best || 0}</strong><small>Beste Serie</small></div>
      </div>
      <div class="gm-progress" role="progressbar" aria-valuenow="${lvl.pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="gm-progress-fill" style="width:${lvl.pct}%"></div>
      </div>
      <div class="gm-level-next">${lvl.next ? `Noch <strong>${lvl.fehlend} Punkte</strong> bis Level ${lvl.nummer + 1} · ${lvl.next.icon} ${lvl.next.name}` : 'Höchstes Level erreicht – stark!'}</div>
      <div class="gm-stufen" aria-label="Alle Level">${stufen}</div>
      ${log ? `<div class="gm-log"><div class="gm-log-title">Zuletzt verdient</div>${log}</div>` : ''}
      <button class="gm-link-btn" onclick="gmOpenPointsInfo()">Wie bekomme ich Punkte?</button>`;
  }

  // Abzeichen: zugeklappt als wischbare Reihe, aufgeklappt als komplettes Verzeichnis
  gmRenderBadges(s, st);

  const impactEl = document.getElementById('gm-impact-card');
  if (impactEl) impactEl.innerHTML = gmImpactCardHtml(false);

  const extraEl = document.getElementById('gm-history-extra');
  if (extraEl) {
    extraEl.innerHTML = `
      <div class="profile-score-cell active">
        <div class="profile-score-cell-label">Scans</div>
        <div class="profile-score-cell-value">${s.scans.count}</div>
      </div>
      <div class="profile-score-cell active">
        <div class="profile-score-cell-label">Gekocht</div>
        <div class="profile-score-cell-value">${s.cooked.count}</div>
      </div>
      <div class="profile-score-cell active">
        <div class="profile-score-cell-label">Abzeichen</div>
        <div class="profile-score-cell-value">${earnedCount}</div>
      </div>`;
  }
}

function gmImpactCardHtml(detailed) {
  const imp = gmImpact();
  if (!imp.einkaeufe && imp.saisonquote == null) {
    return `
      <div class="gm-impact-empty">
        <div style="font-size:32px">🌍</div>
        <p>Schließe deinen ersten Einkauf in der Einkaufsliste ab oder scanne ein paar Produkte – dann siehst du hier, wie viel CO₂ und Wasser du im Vergleich zum deutschen Durchschnitt sparst.</p>
      </div>`;
  }
  const good = imp.co2Gespart >= 0;
  const maxBar = Math.max(0.1, ...imp.monate.map(m => Math.abs(m.co2)));
  const bars = imp.monate.map(m => {
    const h = Math.round(Math.abs(m.co2) / maxBar * 100);
    const leer = Math.abs(m.co2) < 0.005;
    return `
      <div class="gm-bar-col" title="${m.label}: ${_gmFmt(m.co2)} kg">
        <div class="gm-bar-wrap">${leer ? '' : `<div class="gm-bar${m.co2 < 0 ? ' gm-bar--bad' : ''}" style="height:${Math.max(h, 4)}%"></div>`}</div>
        <span class="gm-bar-lbl">${m.label}</span>
      </div>`;
  }).join('');

  return `
    <div class="gm-impact-hero${good ? '' : ' gm-impact-hero--bad'}">
      <div class="gm-impact-big">${_gmFmt(Math.abs(imp.co2Gespart))} <small>kg CO₂</small></div>
      <div class="gm-impact-sub">${good ? 'weniger als ein gleich schwerer Ø-Einkauf in Deutschland' : 'mehr als ein gleich schwerer Ø-Einkauf – ein paar Alternativen machen den Unterschied'}</div>
    </div>
    ${good && imp.co2Gespart >= 0.5 ? `
    <div class="gm-equiv-row g9">
      <div class="gm-equiv span-4"><span class="gm-equiv-icon">🚗</span><span><strong>${_gmFmt(imp.autoKm, 0)} km</strong> Autofahrt vermieden</span></div>
      <div class="gm-equiv span-5"><span class="gm-equiv-icon">🌳</span><span>So viel bindet eine Buche in <strong>${_gmFmt(imp.buchenTage, 0)} Tagen</strong></span></div>
    </div>` : ''}
    <div class="gm-impact-grid g9">
      <div class="gm-impact-cell span-3"><span class="gm-impact-val">${_gmFmt(imp.co2Monat)} kg</span><span class="gm-impact-lbl">CO₂ im ${_GM_MONATE_KURZ[new Date().getMonth()]}.</span></div>
      <div class="gm-impact-cell span-3"><span class="gm-impact-val">${_gmFmt(Math.max(0, imp.wasserGespart) / 1000)} m³</span><span class="gm-impact-lbl">Wasser gespart</span></div>
      <div class="gm-impact-cell span-3"><span class="gm-impact-val">${imp.saisonquote != null ? imp.saisonquote + ' %' : '–'}</span><span class="gm-impact-lbl">Saisonquote</span></div>
      <div class="gm-impact-cell gm-impact-cell--row span-9"><span class="gm-impact-val">${imp.alternativen}</span><span class="gm-impact-lbl">Alternativen gekauft${imp.co2Alternativen > 0 ? ` · ≈ ${_gmFmt(imp.co2Alternativen)} kg CO₂` : ''}</span></div>
    </div>
    ${imp.einkaeufe ? `
    <div class="gm-bars-title">CO₂ gespart pro Monat</div>
    <div class="gm-bars">${bars}</div>` : ''}
    ${detailed ? gmMethodHtml() : `<button class="gm-link-btn" onclick="gmOpenImpactSheet()">Wie wird das berechnet?</button>`}`;
}

function gmMethodHtml() {
  return `
    <div class="gm-method">
      <h3>So rechnet Saisonovo</h3>
      <p><strong>Gespartes CO₂</strong>: Für jeden abgeschlossenen Einkauf berechnet die App den Fußabdruck aller Artikel (Saisondaten, Herkunft, tierische Produkte) und vergleicht ihn mit dem, was dieselbe Menge Lebensmittel im deutschen Durchschnitt verursacht (~1.700 kg CO₂ bei ~975 kg Lebensmitteln pro Kopf und Jahr). Artikel ohne Daten (z. B. Nudeln, Gewürze) zählen neutral.</p>
      <p><strong>Saisonquote</strong>: Anteil der Obst- und Gemüseartikel in deinen Einkäufen und Scans, die gerade grüne Saison-Ampel hatten.</p>
      <p><strong>Alternativen</strong>: Differenz zwischen tierischem Produkt und gewählter Alternative pro Portion – nur, wenn für beide belastbare Werte vorliegen.</p>
      <p><strong>Vergleiche</strong>: Pkw 164 g CO₂e pro Personenkilometer (Umweltbundesamt, Bezugsjahr 2023). Eine durchschnittliche Buche bindet etwa 12,5 kg CO₂ pro Jahr (Wald-Zentrum der Universität Münster).</p>
      <p class="gm-method-note">Alle Werte sind Schätzungen auf Basis von Durchschnittsdaten (u. a. Poore & Nemecek 2018, Verbraucherzentrale-Saisonkalender, BZL/BLE). Sie zeigen Größenordnungen, keine exakte Bilanz.</p>
    </div>`;
}

function _gmSheet(html) {
  const overlay = document.createElement('div');
  overlay.className = 'shopping-done-overlay';
  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 250); };
  overlay.onclick = close;
  overlay.innerHTML = `
    <div class="shopping-done-sheet gm-sheet" onclick="event.stopPropagation()">
      ${html}
      <button class="shopping-done-yes" style="width:100%" data-close>Schließen</button>
    </div>`;
  overlay.querySelector('[data-close]').onclick = close;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function gmOpenImpactSheet() {
  _gmSheet(`<h2 class="shopping-done-title">Deine Wirkung</h2><div class="gm-sheet-body">${gmImpactCardHtml(true)}</div>`);
}

function gmOpenPointsInfo() {
  _gmSheet(`
    <h2 class="shopping-done-title">So sammelst du Punkte</h2>
    <div class="gm-sheet-body">
      <div class="gm-rule"><span>📷 Produkt scannen (je Produkt 1× pro Tag)</span><strong>+2</strong></div>
      <div class="gm-rule"><span>🟢 … und es ist gerade in Saison / Öko-Score A–B</span><strong>+3</strong></div>
      <div class="gm-rule"><span>🍳 Rezept aus dem Kochbuch gekocht</span><strong>+10</strong></div>
      <div class="gm-rule"><span>📅 … und es ist voll in Saison</span><strong>+5</strong></div>
      <div class="gm-rule"><span>🛍️ Einkauf abgeschlossen</span><strong>+5</strong></div>
      <div class="gm-rule"><span>🟢 je saisonalem Artikel im Einkauf (max. 10)</span><strong>+1</strong></div>
      <div class="gm-rule"><span>♻️ Pflanzliche Alternative gekauft</span><strong>+1</strong></div>
      <div class="gm-rule"><span>🏆 Challenge abgeschlossen</span><strong>+5 – 50</strong></div>
      <div class="gm-rule"><span>🔥 Serie: 3 / 7 / 14 / 30 Tage aktiv</span><strong>+5 / 15 / 25 / 50</strong></div>
      <p class="gm-method-note">Scan-Punkte sind auf 30 pro Tag begrenzt. Aktiv heißt: scannen, kochen, einkaufen oder eine Alternative wählen.</p>
    </div>`);
}

let _gmBadgesOffen = false;

function gmToggleBadges() {
  _gmBadgesOffen = !_gmBadgesOffen;
  gmRenderBadges();
}

// Rundes Abzeichen: Ring zeigt den Fortschritt, darunter Name und wofür es das Abzeichen gibt.
function _gmBadgeHtml(b, s, st, extraCls) {
  const earned = !!s.badges[b.id];
  const val = Math.min(b.wert(st), b.ziel);
  const pct = earned ? 100 : Math.round(val / b.ziel * 100);
  const status = earned
    ? `<span class="gm-rb-state gm-rb-state--ok">✓ ${new Date(s.badges[b.id]).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>`
    : b.zukunft
      ? `<span class="gm-rb-state">ab ${_GM_MONATE[Number(b.monat.slice(5)) - 1]}</span>`
      : b.vorbei
        ? `<span class="gm-rb-state">${val}/${b.ziel} · vorbei</span>`
        : `<span class="gm-rb-state">${_gmFmt(val, Number.isInteger(val) ? 0 : 1)}/${b.ziel}</span>`;
  return `
    <button class="gm-rbadge${earned ? ' is-earned' : ''}${b.monat ? ' is-month' : ''}${b.zukunft ? ' is-future' : ''} ${extraCls || ''}" onclick="gmShowBadge('${b.id}')" aria-label="${_gmEsc(b.titel)}: ${_gmEsc(b.kurz || b.text)}${earned ? ' (erreicht)' : ''}">
      <span class="gm-rb-ring" style="--p:${pct}"><span class="gm-rb-circle"><span class="gm-rb-icon">${b.icon}</span></span></span>
      <span class="gm-rb-title">${_gmEsc(b.titel)}</span>
      <span class="gm-rb-text">${_gmEsc(b.kurz || b.text)}</span>
      ${status}
    </button>`;
}

function gmRenderBadges(s, st) {
  s = s || gmLoad();
  st = st || gmStats();
  const alle = gmAllBadges();
  const earnedCount = alle.filter(b => s.badges[b.id]).length;
  const countEl = document.getElementById('gm-badge-count');
  if (countEl) countEl.textContent = `${earnedCount} von ${alle.length}`;
  const el = document.getElementById('gm-badges');
  if (!el) return;

  const toggle = `<button class="gm-badge-toggle" onclick="gmToggleBadges()" aria-expanded="${_gmBadgesOffen}">${_gmBadgesOffen ? 'Weniger anzeigen ▴' : `Alle ${alle.length} Abzeichen anzeigen ▾`}</button>`;

  if (!_gmBadgesOffen) {
    // Reihenfolge: erreichte (neueste zuerst) → aktueller Monat → nach Fortschritt
    const jetztKey = _gmToday().slice(0, 7);
    const sortiert = alle.filter(b => !b.zukunft && !b.vorbei || s.badges[b.id]).sort((a, b) => {
      const ea = s.badges[a.id], eb = s.badges[b.id];
      if (ea && eb) return eb.localeCompare(ea);
      if (ea || eb) return ea ? -1 : 1;
      if (a.monat === jetztKey || b.monat === jetztKey) return a.monat === jetztKey ? -1 : 1;
      return (b.wert(st) / b.ziel) - (a.wert(st) / a.ziel);
    });
    el.innerHTML = `<div class="gm-badge-scroller" role="list">${sortiert.map(b => _gmBadgeHtml(b, s, st)).join('')}</div>${toggle}`;
    return;
  }

  const gruppen = [
    ...GM_BADGE_GRUPPEN.map(g => ({ titel: g.titel, badges: g.ids.map(id => GM_BADGES.find(b => b.id === id)).filter(Boolean) })),
    { titel: `Monatsabzeichen ${new Date().getFullYear()}`, badges: gmMonthBadges() },
  ];
  el.innerHTML = gruppen.map(g => `
    <div class="gm-badge-group">
      <div class="gm-badge-group-head"><span>${g.titel}</span><span>${g.badges.filter(b => s.badges[b.id]).length}/${g.badges.length}</span></div>
      <div class="g9 gm-badge-grid">${g.badges.map(b => _gmBadgeHtml(b, s, st, 'span-3')).join('')}</div>
    </div>`).join('') + toggle;
}

function gmShowBadge(id) {
  const b = gmAllBadges().find(x => x.id === id);
  if (!b) return;
  const s = gmLoad();
  const st = gmStats();
  const earned = s.badges[id];
  const val = Math.min(b.wert(st), b.ziel);
  _gmSheet(`
    <span class="gm-rb-ring gm-rb-ring--lg${earned ? ' is-earned' : ''}" style="--p:${earned ? 100 : Math.round(val / b.ziel * 100)}"><span class="gm-rb-circle"><span class="gm-rb-icon"${earned ? '' : ' style="filter:grayscale(1);opacity:.55"'}>${b.icon}</span></span></span>
    <h2 class="shopping-done-title">${b.titel}</h2>
    <p class="shopping-done-sub">${b.text}</p>
    <p class="shopping-done-sub"><strong>${earned
      ? `Erreicht am ${new Date(earned).toLocaleDateString('de-DE')}`
      : `Fortschritt: ${_gmFmt(val, Number.isInteger(val) ? 0 : 1)} / ${b.ziel}`}</strong></p>`);
}

/* ───────────── Scanner-Anbindung ───────────── */

// Wird von app.js nach jedem erfolgreichen Scan aufgerufen (Barcode, PLU, Namenssuche).
// info: { source, code, name, produktId, ampel, grade, bio }
function gmOnScan(info) {
  try {
    const s = gmLoad();
    const today = _gmToday();
    if (s.scans.daily.date !== today) s.scans.daily = { date: today, keys: [], pts: 0 };

    const key = info.produktId || info.code || (info.name || '').toLowerCase();
    const isNew = key && !s.scans.daily.keys.includes(key);
    const saisonal = info.ampel === 'gruen';
    const oekoGut = /^[AB]$/.test(String(info.grade || '').toUpperCase());
    const gutGewaehlt = saisonal || oekoGut;
    let pts = 0;

    if (isNew) {
      s.scans.daily.keys.push(key);
      s.scans.count += 1;
      if (saisonal) s.scans.seasonal += 1;
      if (info.bio) s.scans.bio += 1;
      const roh = 2 + (gutGewaehlt ? 3 : 0);
      pts = Math.max(0, Math.min(roh, 30 - s.scans.daily.pts));
      s.scans.daily.pts += pts;
      if (pts) gmAddPoints(pts, `Scan: ${info.name || info.code}`, s);

      let hist = [];
      try { hist = JSON.parse(localStorage.getItem(GM_SCAN_HISTORY_KEY) || '[]'); } catch (e) { hist = []; }
      hist.unshift({ t: Date.now(), code: info.code || null, name: info.name || null, produktId: info.produktId || null, ampel: info.ampel || null, grade: info.grade || null, bio: !!info.bio });
      localStorage.setItem(GM_SCAN_HISTORY_KEY, JSON.stringify(hist.slice(0, 300)));
    }

    gmRecordActivity(s);
    gmSave(s);
    if (isNew && typeof updateChallengeProgress === 'function') updateChallengeProgress('scan-10', 1);

    _gmRenderScanExtra(info, {
      isNew, pts, streak: gmCurrentStreak(s), limit: isNew && !pts,
      bonus: pts > 2 ? (saisonal ? 'Saison-Bonus' : 'Öko-Bonus') : '',
    });
    gmCheckProgress();
  } catch (e) {
    // Der Scanner selbst darf durch die Erweiterung nie kaputtgehen.
    console.warn('Gamification (Scan):', e);
  }
}

function _gmRenderScanExtra(info, res) {
  const el = document.getElementById('scan-gm-extra');
  if (!el) return;

  let pointsHtml;
  if (res.isNew && res.pts) {
    pointsHtml = `<div class="gm-scan-points"><span class="gm-scan-pts">+${res.pts} Punkte</span>${res.bonus ? `<span class="gm-scan-bonus">inkl. ${res.bonus}</span>` : ''}${res.streak ? `<span class="gm-scan-streak">🔥 ${res.streak}</span>` : ''}</div>`;
  } else if (res.limit) {
    pointsHtml = `<div class="gm-scan-points gm-scan-points--muted">Tageslimit für Scan-Punkte erreicht – morgen geht's weiter.</div>`;
  } else {
    pointsHtml = `<div class="gm-scan-points gm-scan-points--muted">Heute schon gescannt – Punkte gibt's 1× pro Produkt und Tag.</div>`;
  }

  // Nachhaltigkeitszahl: CO₂ pro kg im Vergleich zum Ø-Lebensmittel in Deutschland
  let klimaHtml = '';
  try {
    const fp = typeof _getFootprintData === 'function' ? _getFootprintData(info.name || '', []) : null;
    const viaId = !fp && info.produktId && typeof _saisondaten !== 'undefined' && _saisondaten
      ? _getFootprintData(_saisondaten.produkte.find(p => p.id === info.produktId)?.name || '', [])
      : null;
    const data = fp || viaId;
    if (data && data.co2_kg != null) {
      const base = _gmBaselinePerKg().co2;
      const ratio = data.co2_kg / base;
      const pct = Math.min(100, Math.round(ratio / 3 * 100));
      const cls = ratio <= 0.6 ? 'gut' : ratio <= 1.5 ? 'mittel' : 'hoch';
      klimaHtml = `
        <div class="gm-klima">
          <div class="gm-klima-head"><span>Klimabilanz</span><strong>≈ ${_gmFmt(data.co2_kg)} kg CO₂ / kg</strong></div>
          <div class="gm-klima-bar"><div class="gm-klima-fill gm-klima-fill--${cls}" style="width:${pct}%"></div><div class="gm-klima-mark" style="left:${Math.round(1 / 3 * 100)}%"></div></div>
          <div class="gm-klima-sub">Strich = Ø Lebensmittel in Deutschland (${_gmFmt(base)} kg CO₂/kg)</div>
        </div>`;
    }
  } catch (e) { klimaHtml = ''; }

  // Passende Rezepte aus dem Kochbuch
  let rezepteHtml = '';
  const treffer = kbRecipesWithProduct(info);
  if (treffer.length) {
    rezepteHtml = `
      <div class="gm-scan-recipes">
        <div class="detail-card-label">Passt in diese Rezepte</div>
        <div class="gm-scan-recipe-row">
          ${treffer.slice(0, 3).map(r => `<button class="gm-scan-recipe" onclick="kbOpenRecipe('${r.id}', 'scan')"><span>${r.emoji || '🍽️'}</span>${_gmEsc(r.titel)}</button>`).join('')}
        </div>
      </div>`;
  }

  el.innerHTML = pointsHtml + klimaHtml + rezepteHtml;
}

/* ───────────── Einkauf-Anbindung ───────────── */

// Wird von app.js in finishShopping(true) aufgerufen, bevor die Liste geleert wird.
function gmOnPurchase(items) {
  try {
    const s = gmLoad();
    const saisonal = (items || []).filter(i => i.ampel === 'gruen').length;
    const pts = 5 + Math.min(10, saisonal);
    gmAddPoints(pts, `Einkauf${saisonal ? ` (${saisonal}× saisonal)` : ''}`, s);
    s.purchaseBonus += pts;
    gmRecordActivity(s);
    gmSave(s);
    setTimeout(() => _showToast(`⭐ +${pts} Punkte für deinen Einkauf`), 50);
    gmCheckProgress();
  } catch (e) {
    console.warn('Gamification (Einkauf):', e);
  }
}

function gmOnGoodChoice() {
  try {
    gmRecordActivity();
    gmCheckProgress();
  } catch (e) { console.warn('Gamification:', e); }
}

/* ══════════════════════════════════════════
   KOCHBUCH
   ══════════════════════════════════════════ */

const KB = {
  rezepte: null,
  filter: new Set(),
  suche: '',
  returnTab: 'season',
  view: 'saison',      // Saisonküche: 'saison' | 'kochbuch'
  detailId: null,
  detailPortionen: null,
  _matchCache: {},
};

async function kbLoad() {
  if (KB.rezepte) return KB.rezepte;
  try {
    const res = await fetch('rezepte.json', { cache: 'no-store' });
    const data = await res.json();
    KB.rezepte = data.rezepte || [];
  } catch (e) {
    console.warn('Rezepte konnten nicht geladen werden:', e);
    KB.rezepte = [];
  }
  return KB.rezepte;
}
kbLoad();

function kbStore() {
  try {
    return Object.assign({ favoriten: [], eigene: [] }, JSON.parse(localStorage.getItem(KB_KEY) || '{}'));
  } catch (e) { return { favoriten: [], eigene: [] }; }
}

function kbSaveStore(st) {
  localStorage.setItem(KB_KEY, JSON.stringify(st));
}

function kbAllRecipes() {
  return [...(KB.rezepte || []), ...kbStore().eigene];
}

function kbFind(id) {
  if (KB.temp && KB.temp.id === id) return KB.temp;
  return kbAllRecipes().find(r => r.id === id) || null;
}

function _kbDataReady() {
  return KB.rezepte && typeof _saisondaten !== 'undefined' && _saisondaten && typeof _ernaehrung !== 'undefined' && _ernaehrung;
}

// Der Produkt-Matcher aus app.js erkennt auch zusammengesetzte Wörter ("Kürbiskerne" beginnt
// mit "Kürbis", "Apfelessig" mit "Apfel"). Für Rezepte wären das falsche Treffer – verarbeitete
// Vorratszutaten haben keine Saison. Deshalb hier vorab aussortieren.
const _KB_VORRAT_RE = /(kerne|essig|saft|sirup|mus\b|brühe|öl\b|dose|getrocknet|tk\b|tiefgekühlt|pulver|mehl|flocken|paste|kraut\b|meerrettich)/i;

function _kbMatch(name) {
  if (!name || _KB_VORRAT_RE.test(name)) return null;
  return _matchSaisondatenByName(name);
}

function _kbFootprint(name) {
  if (!name || _KB_VORRAT_RE.test(name)) return null;
  return _getFootprintData(name, []);
}

// Saison-Ampel + CO₂ eines Rezepts für den aktuellen Monat.
function kbRecipeInfo(r, portionen) {
  const port = portionen || r.portionen || 2;
  const faktor = port / (r.portionen || port);
  let summe = 0, saisonZutaten = 0, gruen = 0, gelb = 0, rot = 0;
  let co2 = 0, erfasst = 0;

  const zutaten = (r.zutaten || []).map(z => {
    const produkt = _kbMatch(z.name);
    let ampel = null;
    if (produkt) {
      saisonZutaten += 1;
      const score = _calculateSaisonScore(produkt, []);
      ampel = score?.ampel || 'rot';
      if (ampel === 'gruen') { gruen += 1; summe += 1; }
      else if (ampel === 'gelb') { gelb += 1; summe += 0.5; }
      else rot += 1;
    }
    // CO₂ nur für Zutaten mit belastbaren Daten (Obst/Gemüse aus dem Saisonkalender,
    // tierische Produkte aus ernaehrung.json). Vorratszutaten bleiben bewusst außen vor.
    const fp = _kbFootprint(z.name);
    if (fp && z.menge != null) {
      const kg = _itemToKg({ text: z.name, amount: z.menge * faktor, unit: z.einheit, qty: 1 }, fp);
      co2 += kg * (fp.co2_kg || 0);
      erfasst += 1;
    } else if (fp) {
      co2 += (fp.portion_kg || 0.1) * (fp.co2_kg || 0) * faktor;
      erfasst += 1;
    }
    return { ...z, menge: z.menge != null ? z.menge * faktor : null, produktId: produkt?.id || null, ampel, hatDaten: !!fp };
  });

  const score = saisonZutaten ? summe / saisonZutaten : 0.5;
  let status;
  if (!saisonZutaten) status = { key: 'neutral', label: 'Saisonunabhängig', dot: '⚪' };
  else if (score >= 0.75 && rot === 0) status = { key: 'saison', label: 'In Saison', dot: '🟢' };
  else if (score >= 0.4) status = { key: 'teils', label: 'Teilweise saisonal', dot: '🟡' };
  else status = { key: 'aus', label: 'Außerhalb der Saison', dot: '🔴' };

  return {
    zutaten, score, status, gruen, gelb, rot, saisonZutaten,
    co2Portion: co2 / port, erfasst, zutatenGesamt: zutaten.length, portionen: port,
  };
}

function _kbCo2Label(kg) {
  if (kg < 0.4) return { cls: 'gut', text: 'niedrig' };
  if (kg < 1.0) return { cls: 'mittel', text: 'mittel' };
  return { cls: 'hoch', text: 'hoch' };
}

// Rezepte, in denen ein gescanntes Produkt vorkommt (für die Scan-Ergebniskarte).
function kbRecipesWithProduct(info) {
  if (!_kbDataReady()) return [];
  const ernId = typeof _matchErnaehrung === 'function' ? _matchErnaehrung(info.name || '')?.id : null;
  if (!info.produktId && !ernId) return [];
  const hits = [];
  for (const r of KB.rezepte) {
    if (!KB._matchCache[r.id]) {
      KB._matchCache[r.id] = (r.zutaten || []).map(z => ({
        s: _kbMatch(z.name)?.id || null,
        e: _KB_VORRAT_RE.test(z.name) ? null : (_matchErnaehrung(z.name)?.id || null),
      }));
    }
    if (KB._matchCache[r.id].some(m => (info.produktId && m.s === info.produktId) || (ernId && m.e === ernId))) hits.push(r);
  }
  return hits
    .map(r => ({ r, info: kbRecipeInfo(r) }))
    .sort((a, b) => b.info.score - a.info.score)
    .map(x => x.r);
}

/* ───────────── Saisonküche: Umschalter Saisonkalender ⇄ Kochbuch ───────────── */

// Öffnet das Kochbuch im Tab "Saisonküche". Optional direkt mit Overlay:
// 'heute' (Rezept des Tages), 'kategorien' oder 'gespeichert'.
async function openKochbuch(overlay) {
  KB.view = 'kochbuch';
  await showScreen('season');
  if (overlay === 'heute') kbOpenToday();
  else if (overlay === 'kategorien') kbOvOpen('kategorien');
  else if (overlay === 'gespeichert') kbOvOpen('gespeichert');
}

function skInitTab() {
  const pill = document.getElementById('kb-month-pill');
  if (pill) pill.textContent = `📅 ${_GM_MONATE[new Date().getMonth()]}`;
  skSetView(KB.view, true);
}

function skSetView(view, silent) {
  KB.view = view === 'kochbuch' ? 'kochbuch' : 'saison';
  document.querySelectorAll('.seg-btn').forEach(b => {
    const on = b.dataset.view === KB.view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const track = document.querySelector('.seg-switch-track');
  if (track) track.dataset.active = KB.view;
  const paneS = document.getElementById('pane-saison');
  const paneK = document.getElementById('pane-kochbuch');
  if (paneS) paneS.style.display = KB.view === 'saison' ? '' : 'none';
  if (paneK) paneK.style.display = KB.view === 'kochbuch' ? '' : 'none';
  const regionPill = document.getElementById('sk-region-pill');
  const monthPill = document.getElementById('kb-month-pill');
  if (regionPill) regionPill.hidden = KB.view !== 'saison';
  if (monthPill) monthPill.hidden = KB.view !== 'kochbuch';
  if (KB.view === 'kochbuch') kbRenderKochbuch();
  if (!silent) tabContent.querySelector('.scroll-area')?.scrollTo({ top: 0 });
}

// Kompatibilität mit älteren Aufrufen (kbSetSub / kbInitTab)
function kbSetSub(sub) { openKochbuch(sub === 'suchen' ? null : sub); }
function kbInitTab() { openKochbuch(); }

/* ───────────── Kochbuch-Startansicht ───────────── */

function kbRenderKochbuch() {
  if (!document.getElementById('pane-kochbuch')) return;
  if (!_kbDataReady()) { kbLoad(); setTimeout(kbRenderKochbuch, 400); return; }
  const search = document.getElementById('kb-search');
  if (search && search.value !== KB.suche) search.value = KB.suche;
  kbRenderSavedButton();
  kbRenderTiles();
  kbRenderList();
}

function kbRenderSavedButton() {
  const el = document.getElementById('kb-saved-count');
  if (!el) return;
  const st = kbStore();
  const n = st.favoriten.length + st.eigene.length;
  el.textContent = n;
  el.hidden = n === 0;
}

function kbRenderTiles() {
  const todayEl = document.getElementById('kb-tile-today-preview');
  const r = kbRecipeOfDay();
  if (todayEl && r) {
    todayEl.innerHTML = `
      <span class="kb-tile-emoji">${r.emoji || '🍽️'}</span>
      <span class="kb-tile-sub">${_gmEsc(r.titel)}</span>`;
  }
  const catEl = document.getElementById('kb-tile-cat-preview');
  if (catEl) {
    catEl.innerHTML = `
      <span class="kb-tile-icons">${KB_KATEGORIEN.slice(0, 3).map(k => `<span>${k.icon}</span>`).join('')}</span>
      <span class="kb-tile-sub">${KB_KATEGORIEN.length} Kategorien</span>`;
  }
}

function kbSetSearch(q) {
  KB.suche = q || '';
  kbRenderList();
}

function _kbCardHtml(r, info, favs, inOverlay) {
  const fav = favs.includes(r.id);
  const tags = [];
  if ((r.tags || []).includes('vegan')) tags.push('<span class="kb-tag kb-tag--vegan">vegan</span>');
  else if ((r.tags || []).includes('vegetarisch')) tags.push('<span class="kb-tag">vegetarisch</span>');
  const saisonText = info.saisonZutaten ? `${info.gruen} von ${info.saisonZutaten} frischen Zutaten in Saison` : 'Nur Vorratszutaten';
  const open = inOverlay ? `kbOvOpen('rezept','${r.id}')` : `kbOpenRecipe('${r.id}')`;
  return `
    <div class="kb-card g9" onclick="${open}" role="button" tabindex="0">
      <div class="kb-card-thumb span-2 kb-thumb--${info.status.key}">${r.emoji || '🍽️'}${r.bild ? `<img class="kb-thumb-img" src="${_gmEsc(r.bild)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
      <div class="kb-card-body span-6">
        <div class="kb-card-title">${_gmEsc(r.titel)}</div>
        <div class="kb-card-meta">${r.zeit ? `${r.zeit} Min. · ` : ''}${r.portionen || '?'} Port. ${tags.join('')}</div>
        <div class="kb-card-season kb-season--${info.status.key}">${info.status.dot} ${saisonText}</div>
      </div>
      ${r.eigene
        ? '<span class="kb-fav kb-fav--own span-1" aria-label="Importiert und gespeichert">♥</span>'
        : `<button class="kb-fav span-1${fav ? ' active' : ''}" onclick="event.stopPropagation();kbToggleFav('${r.id}')" aria-label="${fav ? 'Nicht mehr speichern' : 'Rezept speichern'}">${fav ? '♥' : '♡'}</button>`}
    </div>`;
}

function _kbRanked(list) {
  return list.map(r => ({ ...r, _info: kbRecipeInfo(r) }))
    .sort((a, b) => b._info.score - a._info.score || (a.zeit || 99) - (b.zeit || 99));
}

// Liste unter den Kacheln: alle Rezepte nach Saison sortiert – die Suche filtert sie direkt.
function kbRenderList() {
  const listEl = document.getElementById('kb-list');
  if (!listEl) return;
  if (!_kbDataReady()) { kbLoad(); setTimeout(kbRenderList, 400); return; }
  const favs = kbStore().favoriten;
  const q = KB.suche.trim().toLowerCase();
  const rezepte = _kbRanked(kbAllRecipes()).filter(r => {
    if (!q) return true;
    const hay = [r.titel, r.beschreibung, ...(r.zutaten || []).map(z => z.name)].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const label = document.getElementById('kb-list-label');
  if (label) label.textContent = q
    ? `${rezepte.length} Treffer für „${KB.suche.trim()}“`
    : 'Alle Rezepte · nach Saison sortiert';
  listEl.innerHTML = rezepte.length
    ? rezepte.map(r => _kbCardHtml(r, r._info, favs)).join('')
    : `<div class="card kb-empty">Kein Rezept gefunden.<br><button class="gm-link-btn" onclick="KB.suche='';kbRenderKochbuch()">Suche zurücksetzen</button></div>`;
}

function _kbDayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}

// Ernährungsart aus dem Profil → passende Rezepte. Unsere Rezepte enthalten kein Fleisch und
// keinen Fisch, daher schränken "Pescetarier", "Kein Schwein" usw. nichts weiter ein.
const _KB_LOWCARB_RE = /(kartoffel|reis|mehl|hafer|brot|brötchen|brösel|zucker|sirup|nudel|linsen|kichererbsen|bohnen \(dose\))/i;

function kbDietInfo() {
  let diet = [];
  try { diet = JSON.parse(localStorage.getItem('gruenkorb-profile') || '{}').diet || []; } catch (e) { diet = []; }
  const regeln = [];
  if (diet.includes('Veganer') || diet.includes('Frutarier')) regeln.push({ label: 'vegan', test: r => (r.tags || []).includes('vegan') });
  else if (diet.includes('Vegetarier')) regeln.push({ label: 'vegetarisch', test: r => (r.tags || []).some(t => t === 'vegetarisch' || t === 'vegan') });
  if (diet.includes('Laktosefrei')) regeln.push({ label: 'laktosefrei', test: r => !_kbHatMilch(r) });
  if (diet.includes('Glutenfrei')) regeln.push({ label: 'ohne Gluten', test: r => !(r.zutaten || []).some(z => _KB_GLUTEN_RE.test(z.name)) });
  if (diet.includes('Low-Carb/Keto')) regeln.push({ label: 'kohlenhydratarm', test: r => !(r.zutaten || []).some(z => _KB_LOWCARB_RE.test(z.name)) });
  return { regeln, labels: regeln.map(x => x.label), passt: r => regeln.every(x => x.test(r)) };
}

// Rezept des Tages: wechselt täglich, passt zur Ernährung im Profil und bevorzugt Rezepte,
// die gerade voll in Saison sind. Findet sich nichts Passendes, wird die Ernährung gelockert.
function kbRecipeOfDay() {
  const ranked = _kbRanked(KB.rezepte || []);
  const diet = kbDietInfo();
  const passend = ranked.filter(diet.passt);
  const basis = passend.length ? passend : ranked;
  const saison = basis.filter(r => r._info.status.key === 'saison');
  const list = saison.length ? saison : basis;
  if (!list.length) return null;
  const r = list[_kbDayOfYear() % list.length];
  r._dietLabels = passend.length ? diet.labels : [];
  return r;
}

function kbOpenToday() {
  if (!_kbDataReady()) { kbLoad(); setTimeout(kbOpenToday, 300); return; }
  const r = kbRecipeOfDay();
  if (r) kbOvOpen('rezept', r.id, { heute: true });
}

/* ───────────── Kategorien ───────────── */

const _KB_GLUTEN_RE = /(mehl|brot|brötchen|brösel|hafer|nudel|pasta|weizen|dinkel|gerste|roggen|couscous|bulgur|grieß)/i;

function _kbHatMilch(r) {
  return (r.zutaten || []).some(z => !_KB_VORRAT_RE.test(z.name) && _matchErnaehrung(z.name)?._kategorie === 'milchprodukte');
}

const KB_KATEGORIEN = [
  { key: 'saison',       icon: '🟢', titel: 'In Saison',        test: r => r._info.status.key === 'saison' },
  { key: 'vegetarisch',  icon: '🥕', titel: 'Vegetarisch',      test: r => (r.tags || []).some(t => t === 'vegetarisch' || t === 'vegan') },
  { key: 'vegan',        icon: '🌱', titel: 'Vegan',            test: r => (r.tags || []).includes('vegan') },
  { key: 'laktosefrei',  icon: '🥛', titel: 'Laktosefrei',      test: r => !_kbHatMilch(r),
    hinweis: 'Ohne Milch, Butter, Sahne, Käse, Joghurt oder Quark.' },
  { key: 'glutenfrei',   icon: '🌾', titel: 'Ohne Gluten',      test: r => !(r.zutaten || []).some(z => _KB_GLUTEN_RE.test(z.name)),
    hinweis: 'Ohne Mehl, Brot, Hafer & Co. Bei Zöliakie bitte die Packungsangaben von Brühe und Gewürzen prüfen.' },
  { key: 'schnell',      icon: '⏱️', titel: 'Schnell (≤ 30 Min.)', test: r => r.zeit && r.zeit <= 30 },
  { key: 'hauptgericht', icon: '🍽️', titel: 'Hauptgerichte',    test: r => r.typ === 'hauptgericht' },
  { key: 'suppe',        icon: '🍲', titel: 'Suppen & Eintöpfe', test: r => r.typ === 'suppe' },
  { key: 'salat',        icon: '🥗', titel: 'Salate',           test: r => r.typ === 'salat' },
  { key: 'fruehstueck',  icon: '🥣', titel: 'Frühstück & Snacks', test: r => r.typ === 'fruehstueck' },
  { key: 'dessert',      icon: '🍰', titel: 'Süßes',            test: r => r.typ === 'dessert' },
];

function _kbKategorieRezepte(key) {
  const k = KB_KATEGORIEN.find(x => x.key === key);
  if (!k) return [];
  return _kbRanked(kbAllRecipes()).filter(r => { try { return k.test(r); } catch (e) { return false; } });
}

/* ───────────── Overlay (Rezept des Tages, Kategorien, Gespeichert) ───────────── */

// Ein Overlay mit Verlauf: z. B. Kategorien → Vegan → Rezept, mit "Zurück" Schritt für Schritt.
KB.ov = [];

function kbOvOpen(view, arg, opts) {
  if (!document.getElementById('kb-ov')) {
    const ov = document.createElement('div');
    ov.className = 'kb-ov';
    ov.id = 'kb-ov';
    ov.innerHTML = `<div class="kb-ov-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="kb-ov-handle"></div><div class="kb-ov-head" id="kb-ov-head"></div><div class="kb-ov-body" id="kb-ov-body"></div></div>`;
    ov.addEventListener('click', kbOvClose);
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    KB.ov = [];
  }
  if (view === 'rezept') { KB.detailId = arg; KB.detailPortionen = null; }
  KB.ov.push({ view, arg, opts: opts || {} });
  kbOvRender();
}

function kbOvBack() {
  KB.ov.pop();
  if (!KB.ov.length) { kbOvClose(); return; }
  const top = KB.ov[KB.ov.length - 1];
  if (top.view === 'rezept') { KB.detailId = top.arg; KB.detailPortionen = null; }
  kbOvRender();
}

function kbOvClose() {
  const ov = document.getElementById('kb-ov');
  KB.ov = [];
  if (!ov) return;
  ov.classList.remove('open');
  setTimeout(() => ov.remove(), 220);
  // Zahlen auf der Kochbuchseite (z. B. Anzahl Gespeichert) aktualisieren
  if (document.getElementById('pane-kochbuch')) { kbRenderSavedButton(); kbRenderList(); }
}

function _kbOvIsOpen() {
  return !!document.getElementById('kb-ov') && KB.ov.length > 0;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && _kbOvIsOpen()) kbOvClose(); });

function kbOvRender(keepScroll) {
  const head = document.getElementById('kb-ov-head');
  const body = document.getElementById('kb-ov-body');
  if (!head || !body || !KB.ov.length) return;
  const top = KB.ov[KB.ov.length - 1];
  const scroll = keepScroll ? body.scrollTop : 0;
  const back = KB.ov.length > 1
    ? `<button class="kb-ov-back" onclick="kbOvBack()" aria-label="Zurück">‹ ${_gmEsc(_kbOvTitle(KB.ov[KB.ov.length - 2]))}</button>`
    : '<span></span>';
  const close = `<button class="kb-ov-close" onclick="kbOvClose()" aria-label="Schließen"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>`;
  const favs = kbStore().favoriten;

  if (top.view === 'rezept') {
    const r = kbFind(top.arg);
    if (!r) { kbOvBack(); return; }
    const fav = favs.includes(r.id);
    const istTemp = KB.temp && r.id === KB.temp.id;
    const aktion = istTemp
      ? `<button class="kb-ov-save" onclick="kbImportSave()">Speichern</button>`
      : r.eigene
        ? `<span class="kb-ov-saved">♥ Gespeichert</span>`
        : `<button class="kb-fav${fav ? ' active' : ''}" onclick="kbToggleFav('${r.id}')" aria-label="${fav ? 'Nicht mehr speichern' : 'Rezept speichern'}">${fav ? '♥' : '♡'}</button>`;
    head.innerHTML = `${back}<div class="kb-ov-actions">${aktion}${close}</div>`;
    const kicker = top.opts.heute
      ? `<div class="kb-ov-kicker">✨ Rezept des Tages · ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>`
      : (istTemp || r.eigene) && r.quelleName
        ? `<div class="kb-ov-kicker">Importiert von ${_gmEsc(r.quelleName)}</div>`
        : '';
    body.innerHTML = kicker + _kbRecipeBodyHtml(r, kbRecipeInfo(r, KB.detailPortionen), true);
  } else if (top.view === 'kategorien') {
    head.innerHTML = `${back}${close}`;
    body.innerHTML = `
      <h2 class="kb-ov-title">Kategorien</h2>
      <div class="g9 kb-cat-grid">
        ${KB_KATEGORIEN.map(k => {
          const n = _kbKategorieRezepte(k.key).length;
          return `<button class="kb-cat span-3" onclick="kbOvOpen('kategorie','${k.key}')" ${n ? '' : 'disabled'}>
            <span class="kb-cat-icon">${k.icon}</span>
            <span class="kb-cat-name">${k.titel}</span>
            <span class="kb-cat-count">${n} ${n === 1 ? 'Rezept' : 'Rezepte'}</span>
          </button>`;
        }).join('')}
      </div>`;
  } else if (top.view === 'kategorie') {
    const k = KB_KATEGORIEN.find(x => x.key === top.arg);
    const list = _kbKategorieRezepte(top.arg);
    head.innerHTML = `${back}${close}`;
    body.innerHTML = `
      <h2 class="kb-ov-title">${k.icon} ${k.titel}</h2>
      ${k.hinweis ? `<p class="kb-ov-hint">${k.hinweis}</p>` : ''}
      <div class="kb-list">${list.map(r => _kbCardHtml(r, r._info, favs, true)).join('') || '<div class="card kb-empty">Keine Rezepte in dieser Kategorie.</div>'}</div>`;
  } else if (top.view === 'gespeichert') {
    const st = kbStore();
    const gemerkt = _kbRanked((KB.rezepte || []).filter(r => favs.includes(r.id)));
    const eigene = _kbRanked(st.eigene);
    head.innerHTML = `${back}${close}`;
    body.innerHTML = `
      <h2 class="kb-ov-title">♥ Gespeichert</h2>
      <div class="kb-list">${gemerkt.length
        ? gemerkt.map(r => _kbCardHtml(r, r._info, favs, true)).join('')
        : `<div class="card kb-empty"><div style="font-size:30px;margin-bottom:6px">♡</div>Noch nichts gespeichert. Tippe bei einem Rezept auf das Herz, um es hier zu sammeln.</div>`}</div>
      ${eigene.length ? `<div class="section-label">Importierte Rezepte</div><div class="kb-list">${eigene.map(r => _kbCardHtml(r, r._info, favs, true)).join('')}</div>` : ''}
      <button class="recipe-import-btn-prominent kb-import-cta" onclick="kbOvClose();showRecipeImport()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
        Rezept importieren
      </button>`;
  }
  body.scrollTop = scroll;
}

function _kbOvTitle(entry) {
  if (entry.view === 'kategorien') return 'Kategorien';
  if (entry.view === 'kategorie') return KB_KATEGORIEN.find(k => k.key === entry.arg)?.titel || 'Kategorie';
  if (entry.view === 'gespeichert') return 'Gespeichert';
  return kbFind(entry.arg)?.titel || 'Rezept';
}

// Nach einer Aktion (Portionen, Herz, Gekocht) die gerade sichtbare Ansicht neu zeichnen.
function _kbRerender() {
  if (_kbOvIsOpen()) kbOvRender(true);
  else if (KB.detailId && document.querySelector('.kb-detail')) kbRenderDetail(true);
  else if (document.getElementById('pane-kochbuch')) kbRenderKochbuch();
}

function kbToggleFav(id) {
  const st = kbStore();
  const i = st.favoriten.indexOf(id);
  const added = i === -1;
  if (added) st.favoriten.push(id); else st.favoriten.splice(i, 1);
  kbSaveStore(st);
  _showToast(added ? '♥ Gespeichert' : 'Aus „Gespeichert“ entfernt');
  _kbRerender();
  if (_kbOvIsOpen() && document.getElementById('pane-kochbuch')) { kbRenderSavedButton(); kbRenderList(); }
}

// Saisonkalender-Detail: Rezepte, in denen das Lebensmittel vorkommt.
function kbFoodRecipesHtml(produktId) {
  if (!_kbDataReady()) return '';
  const treffer = kbRecipesWithProduct({ produktId, name: '' }).slice(0, 4);
  if (!treffer.length) return '';
  return `
    <div class="card">
      <div class="detail-card-label">Rezepte aus dem Kochbuch</div>
      <div class="gm-scan-recipe-row">
        ${treffer.map(r => `<button class="gm-scan-recipe" onclick="kbOpenRecipe('${r.id}', 'season')"><span>${r.emoji || '🍽️'}</span>${_gmEsc(r.titel)}</button>`).join('')}
      </div>
    </div>`;
}

/* ───────────── Rezept-Detail (eigene Seite oder im Overlay) ───────────── */

async function kbOpenRecipe(id, fromTab) {
  await kbLoad();
  if (!kbFind(id)) return;
  if (_kbOvIsOpen()) kbOvClose();
  if (typeof stopScanner === 'function' && activeTab === 'scan') stopScanner();
  KB.returnTab = fromTab || activeTab || 'season';
  KB.detailId = id;
  KB.detailPortionen = null;
  if (!_kbDataReady()) { setTimeout(() => kbOpenRecipe(id, fromTab), 300); return; }
  kbRenderDetail();
}

function kbCloseDetail() {
  KB.detailId = null;
  showScreen(KB.returnTab || 'season');
}

function kbChangePortions(delta) {
  const r = kbFind(KB.detailId);
  if (!r) return;
  const cur = KB.detailPortionen || r.portionen || 2;
  KB.detailPortionen = Math.max(1, Math.min(12, cur + delta));
  _kbRerender();
}

function _kbCookedToday(id) {
  const s = gmLoad();
  const today = _gmToday();
  return s.cooked.log.some(l => l.id === id && l.d === today);
}

// Gemeinsamer Inhalt von Rezeptseite und Rezept-Overlay.
function _kbRecipeBodyHtml(r, info, inOverlay) {
  const co2Lbl = _kbCo2Label(info.co2Portion);
  const cooked = _kbCookedToday(r.id);
  const ampelBadge = a => a
    ? `<span class="recipe-ing-badge ${{ gruen: 'recipe-ing-badge-gruen', gelb: 'recipe-ing-badge-gelb', rot: 'recipe-ing-badge-rot' }[a]}">${{ gruen: 'In Saison', gelb: 'Bedingt', rot: 'Außer Saison' }[a]}</span>`
    : '';
  const zutatenHtml = info.zutaten.map(z => {
    const menge = z.menge != null ? `${_fmtAmount(z.menge)} ${z.einheit || ''}`.trim() : '';
    const klick = z.produktId ? ` onclick="kbOvClose();showFoodDetails('${z.produktId}')" style="cursor:pointer"` : '';
    return `
      <li class="kb-ing"${klick}>
        <span class="kb-ing-amount">${_gmEsc(menge)}</span>
        <span class="kb-ing-name">${z.produktId && typeof produktIcon === 'function' ? produktIcon(z.produktId, 'pi-ing') : ''}${_gmEsc(z.name)}</span>
        ${ampelBadge(z.ampel)}
      </li>`;
  }).join('');
  const schritteHtml = (r.schritte || []).length
    ? `<ol class="kb-steps">${r.schritte.map(s => `<li>${_gmEsc(s)}</li>`).join('')}</ol>`
    : (r.quelle ? `<p class="sub">Für dieses Rezept wurde keine Zubereitung gefunden – sie steht auf der Originalseite.</p>` : '');
  const pts = 10 + (info.status.key === 'saison' ? 5 : 0);

  return `
      <div class="kb-hero kb-thumb--${info.status.key}${inOverlay ? ' kb-hero--sm' : ''}">${r.emoji || '🍽️'}${r.bild ? `<img class="kb-hero-img" src="${_gmEsc(r.bild)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
      <h1 class="kb-detail-title">${_gmEsc(r.titel)}</h1>
      ${r.beschreibung ? `<p class="sub">${_gmEsc(r.beschreibung)}</p>` : ''}
      <div class="kb-chip-row">
        ${r.zeit ? `<span class="kb-chip">⏱️ ${r.zeit} Min.</span>` : ''}
        ${(r.tags || []).includes('vegan') ? '<span class="kb-chip">🌱 vegan</span>' : (r.tags || []).includes('vegetarisch') ? '<span class="kb-chip">🥕 vegetarisch</span>' : ''}
        <span class="kb-chip kb-season--${info.status.key}">${info.status.dot} ${info.status.label}</span>
      </div>

      <div class="kb-stats g9">
        <div class="kb-stat span-4">
          <span class="kb-stat-val">${info.saisonZutaten ? `${info.gruen}/${info.saisonZutaten}` : '–'}</span>
          <span class="kb-stat-lbl">frische Zutaten im ${_GM_MONATE[new Date().getMonth()]} in Saison</span>
        </div>
        <div class="kb-stat span-5">
          <span class="kb-stat-val kb-co2--${co2Lbl.cls}">≈ ${_gmFmt(info.co2Portion, 2)} kg</span>
          <span class="kb-stat-lbl">CO₂ pro Portion* · ${co2Lbl.text}</span>
        </div>
      </div>

      <div class="kb-section-head">
        <h2>Zutaten</h2>
        <div class="kb-portions">
          <button onclick="kbChangePortions(-1)" aria-label="Weniger Portionen">−</button>
          <span>${info.portionen} Port.</span>
          <button onclick="kbChangePortions(1)" aria-label="Mehr Portionen">+</button>
        </div>
      </div>
      <ul class="kb-ings card">${zutatenHtml}</ul>

      <button class="btn-primary" onclick="kbAddToList()">🛒 Zutaten auf die Einkaufsliste</button>

      ${schritteHtml ? `<h2 style="margin-top:var(--s-xl)">Zubereitung</h2>${schritteHtml}` : ''}
      ${r.quelle ? `<a class="btn-outline kb-source-link" href="${_gmEsc(r.quelle)}" target="_blank" rel="noopener">${/instagram\.com/i.test(r.quelle) ? 'Zum Instagram-Beitrag ↗' : 'Zum Originalrezept ↗'}</a>` : ''}
      ${KB.temp && r.id === KB.temp.id ? `<button class="btn-outline kb-import-save-big" onclick="kbImportSave()">♡ Im Kochbuch speichern</button>` : ''}

      <div class="kb-cook-card">
        ${cooked
          ? `<div class="kb-cooked-done">✅ Heute gekocht – Punkte sind gutgeschrieben.</div>`
          : `<button class="kb-cook-btn" onclick="kbMarkCooked('${r.id}')">🍳 Gekocht! <span>+${pts} Punkte</span></button>`}
        <p class="kb-cook-hint">${info.status.key === 'saison' ? 'Voll saisonal – du bekommst den Saison-Bonus.' : 'Tipp: Rezepte mit grüner Ampel bringen +5 Bonuspunkte.'}</p>
      </div>

      <p class="kb-footnote">* Geschätzt aus ${info.erfasst} von ${info.zutatenGesamt} Zutaten mit Umweltdaten (frisches Obst & Gemüse inkl. Herkunft im aktuellen Monat, Milchprodukte, Eier, Fleisch, Fisch). Vorratszutaten wie Öl, Mehl, Getreide und Gewürze sind nicht enthalten.</p>
      ${r.eigene ? `<button class="gm-link-btn kb-delete" onclick="kbDeleteOwn('${r.id}')">Rezept aus dem Kochbuch entfernen</button>` : ''}
      <div style="height:16px"></div>`;
}

function kbRenderDetail(keepScroll) {
  const r = kbFind(KB.detailId);
  if (!r) return;
  const info = kbRecipeInfo(r, KB.detailPortionen);
  const fav = kbStore().favoriten.includes(r.id);
  const scrollTop = keepScroll ? tabContent.querySelector('.scroll-area')?.scrollTop : 0;
  tabContent.innerHTML = `
    <div class="scroll-area kb-detail">
      <div class="kb-detail-topbar">
        <button onclick="kbCloseDetail()" aria-label="Zurück" class="kb-back"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
        <button class="kb-fav kb-fav--lg${fav ? ' active' : ''}" onclick="kbToggleFav('${r.id}')" aria-label="${fav ? 'Nicht mehr speichern' : 'Rezept speichern'}">${fav ? '♥' : '♡'}</button>
      </div>
      ${_kbRecipeBodyHtml(r, info, false)}
    </div>`;
  if (keepScroll) {
    const sa = tabContent.querySelector('.scroll-area');
    if (sa) sa.scrollTop = scrollTop;
  }
}

function kbAddToList() {
  const r = kbFind(KB.detailId);
  if (!r || typeof showRecipeImport !== 'function') return;
  const info = kbRecipeInfo(r, KB.detailPortionen);
  showRecipeImport({
    title: r.titel,
    servings: String(info.portionen),
    ingredients: info.zutaten.map(z => ({
      name: z.name,
      amount: z.menge != null ? Math.round(z.menge * 100) / 100 : null,
      unit: z.einheit || null,
    })),
  });
}

function kbMarkCooked(id) {
  const r = kbFind(id);
  if (!r) return;
  if (_kbCookedToday(id)) { _showToast('Heute schon gewertet ✓'); return; }
  const info = kbRecipeInfo(r);
  const saisonal = info.status.key === 'saison';
  const pts = 10 + (saisonal ? 5 : 0);

  const s = gmLoad();
  s.cooked.count += 1;
  if (saisonal) s.cooked.seasonal += 1;
  s.cooked.log.unshift({ id, d: _gmToday() });
  const monat = _gmToday().slice(0, 7);
  s.cooked.monthly[monat] = (s.cooked.monthly[monat] || 0) + 1;
  s.cooked.log = s.cooked.log.slice(0, 200);
  gmAddPoints(pts, `Gekocht: ${r.titel}`, s);
  gmRecordActivity(s);
  gmSave(s);

  _showToast(`🍳 +${pts} Punkte – guten Appetit!`);
  if (saisonal && typeof _trackGoodDecision === 'function') _trackGoodDecision();
  if (typeof updateChallengeProgress === 'function') updateChallengeProgress('cook-3', 1);
  gmCheckProgress();
  _kbRerender();
}

/* ───────────── Importierte Rezepte im Kochbuch speichern ───────────── */

let _kbLastImport = null;

// Wird von app.js (_renderRecipeResults) für per Link importierte Rezepte aufgerufen.
function kbImportSaveButtonHtml(data) {
  _kbLastImport = data;
  return `<button class="kb-import-save" id="kb-import-save" onclick="kbSaveImported()">☆ Im Kochbuch speichern</button>`;
}

function kbSaveImported() {
  const data = _kbLastImport;
  if (!data) return;
  const st = kbStore();
  const url = document.getElementById('recipe-url-input')?.value?.trim() || null;
  if (st.eigene.some(r => r.titel === data.title && r.quelle === url)) {
    _showToast('Schon im Kochbuch ✓');
    return;
  }
  const portionen = parseInt(String(data.servings || '').match(/\d+/)?.[0] || '2', 10) || 2;
  st.eigene.unshift({
    id: 'own-' + Date.now(),
    titel: data.title || 'Importiertes Rezept',
    emoji: '📌',
    portionen,
    eigene: true,
    quelle: url && /^https?:\/\//i.test(url) ? url : null,
    zutaten: (data.ingredients || []).map(i => ({ name: i.name, menge: i.amount ?? null, einheit: i.unit || null })),
    schritte: [],
    tags: [],
  });
  kbSaveStore(st);
  const btn = document.getElementById('kb-import-save');
  if (btn) { btn.textContent = '★ Im Kochbuch gespeichert'; btn.disabled = true; }
  _showToast('📌 Im Kochbuch gespeichert');
}

function kbDeleteOwn(id) {
  const st = kbStore();
  st.eigene = st.eigene.filter(r => r.id !== id);
  st.favoriten = st.favoriten.filter(f => f !== id);
  kbSaveStore(st);
  KB.detailId = null;
  _showToast('Rezept entfernt');
  if (_kbOvIsOpen()) {
    // im Overlay: zurück zur Liste "Gespeichert"
    KB.ov = KB.ov.filter(e => !(e.view === 'rezept' && e.arg === id));
    if (KB.ov.length) kbOvRender(); else kbOvClose();
    if (document.getElementById('pane-kochbuch')) { kbRenderSavedButton(); kbRenderList(); }
  } else {
    openKochbuch('gespeichert');
  }
}

/* ───────────── Rezeptvorschlag auf der Startseite ───────────── */

function kbRenderHomeSuggestion() {
  const el = document.getElementById('kb-home-suggestion');
  if (!el) return;
  if (!_kbDataReady()) { kbLoad(); setTimeout(kbRenderHomeSuggestion, 400); return; }
  const r = kbRecipeOfDay();
  if (!r) return; // statischer Fallback-Vorschlag bleibt stehen
  const info = r._info;
  const note = document.getElementById('kb-home-diet-note');
  if (note) {
    note.textContent = r._dietLabels.length
      ? `Saisonal und passend zu deiner Ernährung: ${r._dietLabels.join(' · ')}`
      : 'Saisonal ausgewählt – wechselt jeden Tag';
  }
  el.innerHTML = `
    <div class="recipe-card kb-home-card">
      <div class="recipe-thumb kb-home-thumb kb-thumb--${info.status.key}" onclick="kbOpenToday()" style="cursor:pointer"><span>${r.emoji || '🍽️'}</span></div>
      <div class="recipe-body">
        <div class="recipe-header">
          <div class="recipe-title">${_gmEsc(r.titel)}</div>
          <span class="tag">${info.status.dot} ${info.status.label}</span>
        </div>
        <div class="recipe-meta">${r.zeit} min · ${info.gruen} von ${info.saisonZutaten} frischen Zutaten in Saison</div>
        <div class="recipe-note">✦ ${_gmEsc(r.beschreibung || '')}</div>
        <div class="kb-home-actions">
          <button class="recipe-button kb-home-secondary" onclick="kbOpenToday()">Rezept ansehen</button>
          <button class="recipe-button" onclick="KB.detailId='${r.id}';KB.detailPortionen=null;kbAddToList()">+ Einkaufsliste</button>
        </div>
      </div>
    </div>
    <button class="gm-link-btn kb-home-more" onclick="openKochbuch()">Alle Saisonrezepte im Kochbuch ›</button>`;
}

/* ───────────── Tab-Hook ───────────── */

// Wird am Ende von initTab() in app.js aufgerufen.
function gmInitTab(name) {
  try {
    if (name === 'home') {
      gmRenderHomeStrip();
      kbRenderHomeSuggestion();
    }
    if (name === 'profile') gmRenderProfile();
    if (name === 'season') skInitTab();
    gmCheckProgress();
  } catch (e) {
    console.warn('Erweiterungen:', e);
  }
}

/* ══════════════════════════════════════════
   SCANNER AUS DER EINKAUFSLISTE
   Das Scanner-Symbol neben der Suche öffnet ein Fenster in der Bildschirmmitte:
   Kamera nutzen ODER Barcode/PLU eintippen. Beides führt auf die Scanner-Seite,
   von der man über "‹ Einkaufsliste" zurückkommt.
   ══════════════════════════════════════════ */

// Merkt sich, von welchem Tab der Scanner geöffnet wurde (Einkaufsliste oder Saisonkalender)
window.scanFrom = 'list';
const _SCAN_FROM_LABEL = { list: 'Einkaufsliste', season: 'Saisonkalender' };

function scanOpenChooser() {
  if (typeof activeTab !== 'undefined' && activeTab !== 'scan') window.scanFrom = _SCAN_FROM_LABEL[activeTab] ? activeTab : 'list';
  scanCloseChooser(true);
  const ov = document.createElement('div');
  ov.className = 'center-modal';
  ov.id = 'scan-chooser';
  ov.innerHTML = `
    <div class="center-modal-card" role="dialog" aria-modal="true" aria-labelledby="scan-chooser-title" onclick="event.stopPropagation()">
      <button class="center-modal-close" onclick="scanCloseChooser()" aria-label="Schließen"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
      <div id="scan-chooser-body"></div>
    </div>`;
  ov.addEventListener('click', () => scanCloseChooser());
  document.body.appendChild(ov);
  _scanChooserMain();
  requestAnimationFrame(() => ov.classList.add('open'));
}

function _scanChooserMain() {
  const body = document.getElementById('scan-chooser-body');
  if (!body) return;
  body.innerHTML = `
    <div class="center-modal-icon">📷</div>
    <h2 class="center-modal-title" id="scan-chooser-title">Produkt prüfen</h2>
    <p class="center-modal-sub">Wie möchtest du das Produkt erfassen?</p>
    <button class="scan-choice" onclick="scanChooseCamera()">
      <span class="scan-choice-icon">📸</span>
      <span class="scan-choice-text"><strong>Kamera nutzen</strong><small>Barcode mit der Kamera scannen</small></span>
    </button>
    <button class="scan-choice" onclick="_scanChooserCode()">
      <span class="scan-choice-icon">⌨️</span>
      <span class="scan-choice-text"><strong>Code eingeben</strong><small>Barcode oder PLU-Nummer eintippen</small></span>
    </button>`;
}

function _scanChooserCode() {
  const body = document.getElementById('scan-chooser-body');
  if (!body) return;
  body.innerHTML = `
    <button class="center-modal-back" onclick="_scanChooserMain()">‹ Zurück</button>
    <div class="center-modal-icon">⌨️</div>
    <h2 class="center-modal-title" id="scan-chooser-title">Code eingeben</h2>
    <p class="center-modal-sub">Barcode von der Verpackung oder PLU-Nummer vom Obst-/Gemüse-Aufkleber.</p>
    <input id="scan-chooser-input" class="center-modal-input" type="text" inputmode="numeric" pattern="\\d*" autocomplete="off"
      placeholder="z. B. 4012 oder 4006381333931" onkeydown="if(event.key==='Enter') scanChooseCode()" />
    <p class="center-modal-hint" id="scan-chooser-hint">4–5 Stellen = PLU · 8 oder mehr Stellen = Barcode</p>
    <button class="btn-primary" onclick="scanChooseCode()">Prüfen</button>`;
  setTimeout(() => document.getElementById('scan-chooser-input')?.focus(), 50);
}

function scanCloseChooser(sofort) {
  const ov = document.getElementById('scan-chooser');
  if (!ov) return;
  if (sofort) { ov.remove(); return; }
  ov.classList.remove('open');
  setTimeout(() => ov.remove(), 200);
}

async function scanChooseCamera() {
  scanCloseChooser(true);
  await showScreen('scan');
  scanSetBackLabel();
  if (typeof startScanner === 'function') startScanner();
}

async function scanChooseCode() {
  const input = document.getElementById('scan-chooser-input');
  const hint = document.getElementById('scan-chooser-hint');
  const val = (input?.value || '').replace(/\D/g, '');
  if (!(val.length === 4 || val.length === 5 || val.length >= 8)) {
    if (hint) { hint.textContent = 'Bitte 4–5 Ziffern (PLU) oder mindestens 8 Ziffern (Barcode) eingeben.'; hint.classList.add('is-error'); }
    input?.focus();
    return;
  }
  scanCloseChooser(true);
  await showScreen('scan');
  scanSetBackLabel();
  const codeInput = document.getElementById('code-input');
  if (codeInput) codeInput.value = val;
  if (typeof submitCode === 'function') submitCode();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('scan-chooser')) scanCloseChooser(); });

/* ══════════════════════════════════════════
   PROFIL-EINSTELLUNGEN ALS FREISCHWEBENDES FENSTER
   Ersetzt das bisherige Umschalten zwischen Ansicht und Bearbeiten (app.js: toggleEditMode).
   Öffnen: Zahnrad oben rechts · Schließen: X oben rechts oder "Speichern" unten
   (saveProfile() in app.js ruft am Ende toggleEditMode() auf und schließt so das Fenster).
   ══════════════════════════════════════════ */
window.toggleEditMode = function () {
  const ov = document.getElementById('pf-settings-overlay');
  if (!ov) return;
  const offen = ov.style.display !== 'none';
  if (offen) {
    ov.classList.remove('open');
    setTimeout(() => { ov.style.display = 'none'; }, 180);
    if (typeof renderProfileView === 'function') renderProfileView();
    if (typeof gmRenderProfile === 'function') gmRenderProfile();
  } else {
    if (typeof loadEditForm === 'function') loadEditForm();
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) darkToggle.classList.toggle('on', document.documentElement.getAttribute('data-theme') === 'dark');
    ov.style.display = 'flex';
    const body = ov.querySelector('.pf-settings-body');
    if (body) body.scrollTop = 0;
    requestAnimationFrame(() => ov.classList.add('open'));
  }
};

document.addEventListener('keydown', e => {
  const ov = document.getElementById('pf-settings-overlay');
  if (e.key === 'Escape' && ov && ov.style.display !== 'none') window.toggleEditMode();
});

/* ───────────── Kochbuch: Info-Knöpfe an den Kacheln ───────────── */
const KB_INFO = {
  heute: {
    titel: 'Rezept des Tages',
    text: 'Jeden Tag schlägt dir die App ein neues Rezept vor. Es hat gerade Saison und passt zu der Ernährungsart in deinem Profil, z. B. vegan oder laktosefrei. Ein Tipp auf die Kachel öffnet das komplette Rezept mit Zutaten, Zubereitung und Portionsrechner. Dort kannst du die Zutaten auf die Einkaufsliste setzen und nach dem Kochen „Gekocht!“ antippen, um Punkte zu sammeln.',
  },
  kategorien: {
    titel: 'Kategorien',
    text: 'Hier findest du alle Rezepte nach Themen sortiert: In Saison, Vegetarisch, Vegan, Laktosefrei, Ohne Gluten, Schnell (bis 30 Min.), Hauptgerichte, Suppen & Eintöpfe, Salate, Frühstück & Snacks und Süßes. Tippe auf eine Kategorie und dann auf ein Rezept. Mit „‹ Zurück“ kommst du Schritt für Schritt zurück.',
  },
  import: {
    titel: 'Rezept importieren',
    text: 'Füge den Link eines Rezepts ein, z. B. von Chefkoch, einem Blog oder einem öffentlichen Instagram-Beitrag. Die App liest Titel, Zutaten und Zubereitung aus und zeigt das Rezept wie alle anderen im Kochbuch, inklusive Saison-Ampel und CO₂. Alternativ kannst du unter „Text einfügen“ einen Rezepttext einfügen, z. B. die Beschreibung eines Instagram-Beitrags. Mit „Speichern“ landet das Rezept unter „Gespeichert“, mit „Zutaten auf die Einkaufsliste“ wählst du aus, was du einkaufen willst.',
  },
};

function kbInfo(key) {
  const info = KB_INFO[key];
  if (!info) return;
  document.getElementById('kb-info')?.remove();
  const ov = document.createElement('div');
  ov.className = 'center-modal';
  ov.id = 'kb-info';
  ov.innerHTML = `
    <div class="center-modal-card kb-info-card" role="dialog" aria-modal="true" aria-labelledby="kb-info-title" onclick="event.stopPropagation()">
      <button class="center-modal-close" onclick="kbInfoClose()" aria-label="Schließen"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
      <div class="kb-info-kicker">So funktioniert's</div>
      <h2 class="center-modal-title" id="kb-info-title">${info.titel}</h2>
      <p class="kb-info-text">${info.text}</p>
      <button class="btn-primary" onclick="kbInfoClose()">Verstanden</button>
    </div>`;
  ov.addEventListener('click', kbInfoClose);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}

function kbInfoClose() {
  const ov = document.getElementById('kb-info');
  if (!ov) return;
  ov.classList.remove('open');
  setTimeout(() => ov.remove(), 180);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('kb-info')) kbInfoClose(); });


/* Zurück-Knopf im Scanner führt dorthin, wo der Scanner geöffnet wurde */
function scanSetBackLabel() {
  const b = document.querySelector('.scan-back');
  if (!b) return;
  const lbl = _SCAN_FROM_LABEL[window.scanFrom] || 'Einkaufsliste';
  b.textContent = '‹ ' + lbl;
  b.setAttribute('aria-label', 'Zurück zu: ' + lbl);
}
function scanGoBack() {
  const ziel = _SCAN_FROM_LABEL[window.scanFrom] ? window.scanFrom : 'list';
  if (ziel === 'season' && typeof KB !== 'undefined') KB.view = 'saison';
  showScreen(ziel);
}

/* ══════════════════════════════════════════════════════════════════
   REZEPT IMPORTIEREN – per Link (Rezeptseiten & Instagram) oder als Text.
   Das Rezept wird komplett ausgelesen (Titel, Bild, Portionen, Zeit, Zutaten,
   Zubereitung) und danach wie jedes andere Kochbuch-Rezept angezeigt.
   ══════════════════════════════════════════════════════════════════ */

KB.temp = null;          // gerade importiertes, noch nicht gespeichertes Rezept
const KB_IMPORT = { mode: 'link', busy: false, quelle: null };

// Bisherige Funktion aus app.js bleibt für "Zutaten auf die Einkaufsliste" (mit Vorgabe) erhalten.
const _kbOrigShowRecipeImport = showRecipeImport;
window.showRecipeImport = function (preset) {
  if (preset) return _kbOrigShowRecipeImport(preset);
  kbImportOpen();
};

function kbImportOpen(mode) {
  kbImportClose(true);
  KB_IMPORT.mode = mode || 'link';
  KB_IMPORT.busy = false;
  KB_IMPORT.quelle = null;
  const ov = document.createElement('div');
  ov.className = 'center-modal';
  ov.id = 'kb-import';
  ov.innerHTML = `
    <div class="center-modal-card kb-import-card" role="dialog" aria-modal="true" aria-labelledby="kb-import-title" onclick="event.stopPropagation()">
      <button class="center-modal-close" onclick="kbImportClose()" aria-label="Schließen"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
      <h2 class="center-modal-title" id="kb-import-title">Rezept importieren</h2>
      <div class="kb-imp-switch" role="tablist">
        <button role="tab" data-mode="link" onclick="kbImportMode('link')">Link</button>
        <button role="tab" data-mode="text" onclick="kbImportMode('text')">Text einfügen</button>
      </div>
      <div id="kb-imp-link">
        <input id="kb-imp-url" class="kb-imp-input" type="url" inputmode="url" autocomplete="off"
          placeholder="https://… (Chefkoch, Blog, Instagram …)" onkeydown="if(event.key==='Enter')kbImportLoad()">
        <p class="kb-imp-hint">Funktioniert mit den meisten Rezeptseiten und mit öffentlichen Instagram-Beiträgen.</p>
      </div>
      <div id="kb-imp-text" hidden>
        <textarea id="kb-imp-textarea" class="kb-imp-input kb-imp-textarea" rows="8"
          placeholder="Rezepttext hier einfügen, z. B. die Beschreibung eines Instagram-Beitrags:&#10;&#10;Kürbis-Curry&#10;Zutaten für 2 Personen:&#10;500 g Kürbis&#10;1 Dose Kokosmilch&#10;…&#10;Zubereitung:&#10;1. Kürbis würfeln …"></textarea>
      </div>
      <div id="kb-imp-status" class="kb-imp-status" aria-live="polite"></div>
      <button class="btn-primary" id="kb-imp-go" onclick="kbImportLoad()">Rezept laden</button>
    </div>`;
  ov.addEventListener('click', () => kbImportClose());
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  kbImportMode(KB_IMPORT.mode);
}

function kbImportClose(sofort) {
  const ov = document.getElementById('kb-import');
  if (!ov) return;
  if (sofort) { ov.remove(); return; }
  ov.classList.remove('open');
  setTimeout(() => ov.remove(), 180);
}

function kbImportMode(mode) {
  KB_IMPORT.mode = mode;
  document.querySelectorAll('.kb-imp-switch button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const l = document.getElementById('kb-imp-link'), t = document.getElementById('kb-imp-text');
  if (l) l.hidden = mode !== 'link';
  if (t) t.hidden = mode !== 'text';
  const go = document.getElementById('kb-imp-go');
  if (go) go.textContent = mode === 'link' ? 'Rezept laden' : 'Rezept auslesen';
  _kbImpStatus('');
  setTimeout(() => document.getElementById(mode === 'link' ? 'kb-imp-url' : 'kb-imp-textarea')?.focus(), 50);
}

function _kbImpStatus(html, art) {
  const el = document.getElementById('kb-imp-status');
  if (!el) return;
  el.className = 'kb-imp-status' + (art ? ' is-' + art : '');
  el.innerHTML = html;
}

async function kbImportLoad() {
  if (KB_IMPORT.busy) return;
  const go = document.getElementById('kb-imp-go');
  try {
    KB_IMPORT.busy = true;
    if (go) go.disabled = true;
    let rezept;
    if (KB_IMPORT.mode === 'text') {
      const text = document.getElementById('kb-imp-textarea')?.value || '';
      rezept = _kbParseRecipeText(text);
      if (!rezept) throw new Error('In dem Text wurden keine Zutaten erkannt. Achte darauf, dass die Zutaten untereinander stehen, z. B. „200 g Mehl“.');
      if (KB_IMPORT.quelle) { rezept.quelle = KB_IMPORT.quelle; rezept.quelleName = _kbIsInstagram(KB_IMPORT.quelle) ? 'Instagram' : _kbHost(KB_IMPORT.quelle); }
      else rezept.quelleName = 'eigenem Text';
    } else {
      let url = (document.getElementById('kb-imp-url')?.value || '').trim();
      if (url && !/^https?:\/\//i.test(url) && /\./.test(url)) url = 'https://' + url;
      if (!/^https?:\/\/\S+\.\S+/i.test(url)) throw new Error('Bitte einen gültigen Link einfügen (beginnend mit https://…).');
      _kbImpStatus('<span class="recipe-loading-spinner"></span> Rezept wird gelesen …', 'loading');
      rezept = _kbIsInstagram(url) ? await _kbImportInstagram(url) : await _kbImportWebsite(url);
    }
    await kbLoad();
    KB.temp = { ...rezept, id: 'import-tmp' };
    kbImportClose(true);
    if (_kbOvIsOpen()) kbOvClose();
    kbOvOpen('rezept', 'import-tmp', { import: true });
  } catch (e) {
    if (e && e.insta) {
      // Instagram blockiert oft das automatische Auslesen → direkt zum Text-Modus wechseln
      KB_IMPORT.quelle = e.url;
      kbImportMode('text');
      _kbImpStatus(e.ohneRezept
        ? 'Der Beitrag wurde gelesen, aber in der Beschreibung steht kein vollständiges Rezept (oft heißt es „Rezept im Blog“ oder es steht nur im Video). Füge die Zutaten und Schritte hier als Text ein – der Instagram-Link wird als Quelle gespeichert.'
        : 'Instagram hat das automatische Auslesen dieses Beitrags blockiert (z. B. bei privaten Konten). Öffne den Beitrag, kopiere die Beschreibung und füge sie hier ein. Der Link wird als Quelle gespeichert.', 'warn');
    } else {
      _kbImpStatus(_gmEsc(e?.message || 'Das Rezept konnte nicht gelesen werden.'), 'error');
    }
  } finally {
    KB_IMPORT.busy = false;
    if (go) go.disabled = false;
  }
}

/* ───────────── Speichern ───────────── */

function kbImportSave() {
  const t = KB.temp;
  if (!t) return;
  const st = kbStore();
  const dup = st.eigene.find(r => (t.quelle && r.quelle === t.quelle) || (r.titel === t.titel && (r.zutaten || []).length === (t.zutaten || []).length));
  let id;
  if (dup) {
    id = dup.id;
    _showToast('Schon unter „Gespeichert“ ✓');
  } else {
    id = 'own-' + Date.now();
    st.eigene.unshift({ ...t, id, eigene: true, importiertAm: new Date().toISOString().slice(0, 10) });
    kbSaveStore(st);
    _showToast('♥ Unter „Gespeichert“ abgelegt');
  }
  KB.temp = null;
  KB.ov.forEach(e => { if (e.view === 'rezept' && e.arg === 'import-tmp') e.arg = id; });
  if (KB.detailId === 'import-tmp') KB.detailId = id;
  if (_kbOvIsOpen()) kbOvRender(true);
  if (document.getElementById('pane-kochbuch')) { kbRenderSavedButton(); kbRenderList(); }
}

/* ───────────── Laden über öffentliche Proxys ───────────── */

async function _kbFetchHtml(url) {
  // 1. r.jina.ai liefert das HTML der Seite (frei nutzbar, erlaubt Abrufe aus dem Browser)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(`https://r.jina.ai/${url}`, { headers: { 'X-Return-Format': 'html' }, signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200 && !/<title>\s*Just a moment/i.test(html)) return html;
    }
  } catch (_) { /* weiter mit Ersatz-Proxys */ }
  // 2. Ersatz: öffentliche CORS-Proxys
  const ziele = [
    { u: `https://corsproxy.io/?url=${encodeURIComponent(url)}`, raw: true },
    { u: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, raw: false },
    { u: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`, raw: true },
  ];
  for (const z of ziele) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(z.u, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const html = z.raw ? await res.text() : (await res.json())?.contents;
      if (html && html.length > 200) return html;
    } catch (_) { /* nächster Proxy */ }
  }
  return null;
}

function _kbHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return null; }
}

/* ───────────── Rezeptseiten (schema.org/Recipe) ───────────── */

async function _kbImportWebsite(url) {
  const html = await _kbFetchHtml(url);
  if (!html) throw new Error('Die Seite konnte nicht geladen werden. Prüfe den Link und deine Internetverbindung.');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let r = null;
  for (const sc of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const node = _findRecipeNode(JSON.parse(sc.textContent || ''));
      if (node && (node.recipeIngredient || node.ingredients)) { r = node; break; }
    } catch (_) {}
  }
  let rezept = r ? _kbFromSchema(r) : _kbFromMicrodata(doc);
  if (!rezept) {
    // Letzter Versuch: sichtbaren Seitentext wie einen eingefügten Rezepttext auswerten
    const txt = (doc.querySelector('article, main') || doc.body)?.innerText || '';
    rezept = _kbParseRecipeText(txt);
    if (rezept) { rezept.titel = _kbClean(doc.querySelector('meta[property="og:title"]')?.content || doc.title || rezept.titel); rezept._fertig = true; }
  }
  if (!rezept) throw new Error('Auf dieser Seite wurde kein Rezept gefunden. Tipp: Kopiere Zutaten und Zubereitung und nutze „Text einfügen“.');
  if (!rezept.bild) rezept.bild = doc.querySelector('meta[property="og:image"]')?.content || null;
  rezept.quelle = url;
  rezept.quelleName = _kbHost(url);
  if (/chefkoch\./i.test(url) && rezept.titel) rezept.titel = rezept.titel.replace(/\s+von\s+\S+$/i, '');
  if (rezept._fertig) { delete rezept._fertig; return rezept; }
  return _kbFinish(rezept);
}

function _kbClean(s) {
  if (s == null) return '';
  const t = new DOMParser().parseFromString(`<div>${String(s)}</div>`, 'text/html').body.textContent || '';
  return t.replace(/\s+/g, ' ').trim();
}

function _kbIsoMin(d) {
  const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const min = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return min || null;
}

function _kbImage(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return _kbImage(img[0]);
  return img.url || img.contentUrl || null;
}

function _kbSteps(ins) {
  const out = [];
  const walk = n => {
    if (!n) return;
    if (typeof n === 'string') {
      const t = _kbClean(n.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li)>/gi, '\n'));
      const teile = n.includes('\n') || /<(br|p|li)/i.test(n)
        ? n.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li)>/gi, '\n').split(/\n+/).map(_kbClean)
        : [t];
      teile.filter(Boolean).forEach(x => out.push(x));
      return;
    }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.itemListElement) { walk(n.itemListElement); return; }
    if (n.text) { walk(n.text); return; }
    if (n.name) walk(n.name);
  };
  walk(ins);
  // Ein einziger langer Absatz → in Schritte zu je ca. zwei Sätzen teilen
  if (out.length === 1 && out[0].length > 280) {
    const saetze = out[0].split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
    const grp = [];
    for (let i = 0; i < saetze.length; i += 2) grp.push(saetze.slice(i, i + 2).join(' '));
    return grp;
  }
  return out.map(x => x.replace(/^\d+[.)]\s*/, '')).filter(x => x.length > 1);
}

function _kbFromSchema(r) {
  const zutatenRaw = (r.recipeIngredient || r.ingredients || []).map(_kbClean).filter(Boolean);
  if (!zutatenRaw.length) return null;
  const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield.join(' ') : String(r.recipeYield || '');
  const kw = [r.keywords, r.recipeCategory, r.suitableForDiet, r.recipeCuisine].flat().filter(Boolean).join(' ');
  return {
    titel: _kbClean(r.name) || 'Importiertes Rezept',
    beschreibung: _kbClean(r.description).split(/\s*▶|\s+Über [\d.]+ Bewertungen/)[0].slice(0, 220) || null,
    bild: _kbImage(r.image),
    portionen: parseInt(yieldRaw.match(/\d+/)?.[0] || '', 10) || null,
    zeit: _kbIsoMin(r.totalTime) || ((_kbIsoMin(r.prepTime) || 0) + (_kbIsoMin(r.cookTime) || 0)) || null,
    zutatenRaw,
    schritte: _kbSteps(r.recipeInstructions),
    _kw: kw,
  };
}

function _kbFromMicrodata(doc) {
  const ings = [...doc.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')].map(e => _kbClean(e.textContent)).filter(Boolean);
  if (!ings.length) return null;
  const steps = [...doc.querySelectorAll('[itemprop="recipeInstructions"]')].map(e => e.innerText || e.textContent);
  return {
    titel: _kbClean(doc.querySelector('[itemprop="name"]')?.textContent || doc.querySelector('h1')?.textContent || doc.title),
    zutatenRaw: ings,
    schritte: _kbSteps(steps.join('\n')),
    portionen: parseInt(doc.querySelector('[itemprop="recipeYield"]')?.textContent?.match(/\d+/)?.[0] || '', 10) || null,
  };
}

/* ───────────── Instagram ───────────── */

function _kbIsInstagram(url) { return /(^|\.)instagram\.com\//i.test(url) || /instagr\.am\//i.test(url); }

async function _kbImportInstagram(url) {
  const code = url.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i)?.[1];
  const sauber = code ? `https://www.instagram.com/p/${code}/` : url.split('?')[0];
  let caption = null, bild = null, autor = null;

  // 1. Die öffentliche Einbettungsseite enthält die Beschreibung meist auch ohne Anmeldung
  if (code) {
    const html = await _kbFetchHtml(`https://www.instagram.com/p/${code}/embed/captioned/`);
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cap = doc.querySelector('.Caption');
      if (cap) {
        autor = cap.querySelector('.CaptionUsername')?.textContent?.trim() || null;
        cap.querySelectorAll('.CaptionUsername, .CaptionComments').forEach(e => e.remove());
        caption = _kbHtmlToText(cap.innerHTML);
      }
      if (!caption) caption = _kbCaptionFromJson(html);
      bild = doc.querySelector('img.EmbeddedMediaImage')?.src || null;
    }
  }
  // 2. Sonst die Beitragsseite selbst (Vorschau-Text im og:description)
  if (!caption) {
    const html = await _kbFetchHtml(sauber);
    if (html) {
      caption = _kbCaptionFromJson(html);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (!caption) {
        const og = doc.querySelector('meta[property="og:description"]')?.content || doc.querySelector('meta[name="description"]')?.content || '';
        const m = og.match(/:\s*[„“"](.+)["“”]\s*\.?\s*$/s);
        caption = m ? m[1] : null;
      }
      bild = bild || doc.querySelector('meta[property="og:image"]')?.content || null;
    }
  }
  const rezept = caption ? _kbParseRecipeText(caption) : null;
  if (!rezept) { const err = new Error('instagram'); err.insta = true; err.ohneRezept = !!caption; err.url = sauber; throw err; }
  rezept.quelle = sauber;
  rezept.quelleName = autor ? `Instagram · @${autor.replace(/^@/, '')}` : 'Instagram';
  rezept.bild = rezept.bild || bild;
  return rezept;
}

function _kbHtmlToText(html) {
  const t = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  return (new DOMParser().parseFromString(`<div>${t}</div>`, 'text/html').body.textContent || '').trim();
}

function _kbCaptionFromJson(html) {
  const pats = [
    /"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /"caption"\s*:\s*\{[^{}]*?"text"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /\\"caption\\":\{[^{}]*?\\"text\\":\\"((?:\\\\.|[^"\\])*)\\"/,
  ];
  for (const re of pats) {
    const m = html.match(re);
    if (!m) continue;
    try {
      let t = JSON.parse(`"${m[1]}"`);
      if (/\\n|\\u/.test(t)) { try { t = JSON.parse(`"${t}"`); } catch (_) {} }
      if (t && t.length > 20) return t;
    } catch (_) {}
  }
  return null;
}

/* ───────────── Freier Rezepttext (z. B. Instagram-Beschreibung) ───────────── */

const _KB_H_ZUT = /^(zutaten|ingredients?|du brauchst|ihr braucht|das brauchst du|was du brauchst|einkaufsliste|für \d+\s*(personen|portionen|pers))\b/i;
const _KB_H_ZUB = /^(zubereitung|anleitung|so geht'?s|so wird'?s gemacht|und so geht'?s|so gehts|instructions?|method|directions|schritte|steps|how to|preparation)\b/i;
const _KB_MENGE = /^((\d+[.,/]?\d*|[½⅓⅔¼¾⅛])\s*(-|–|bis)?\s*\d*\s*(kg|g|gr\.?|mg|l|ml|cl|dl|el|tl|tbsp|tsp|cups?|tassen?|becher|pck\.?|päckchen|packungen?|bund|zehen?|scheiben?|dosen?|gläser?|glas|prisen?|msp\.?|stück|stk\.?|handvoll|zweige?|blätter|blatt|knollen?|köpfe?|kopf|große?n?|kleine?n?|mittelgroße?)?\b|(etwas|eine? prise|1 prise|prise|salz|pfeffer|öl zum|n\.\s?b\.))/i;

function _kbStripLine(l) {
  return l
    .replace(/[\u200d\ufe0f]/g, '')
    .replace(/^[^\p{L}\p{N}½⅓⅔¼¾⅛]+/u, '')          // Aufzählungszeichen & Emojis am Anfang
    .replace(/\s*[\p{Extended_Pictographic}]+\s*$/u, '') // Emojis am Ende
    .replace(/\s+/g, ' ')
    .trim();
}

function _kbParseRecipeText(text) {
  if (!text || text.trim().length < 15) return null;
  let roh = String(text).replace(/\r/g, '');
  // Instagram schreibt Listen oft in eine Zeile, getrennt durch • oder ▪️
  roh = roh.replace(/\s+[•▪◾◽▫·]\s*/g, '\n');
  const zeilen = roh.split('\n').map(l => l.trim());

  let titel = null, portionen = null, zeit = null, beschreibung = null;
  const zutaten = [], schritte = [];
  let modus = null;          // null | 'zut' | 'zub'

  for (const original of zeilen) {
    if (!original) continue;
    if (/^#|^@/.test(original) && !/\s\w{3,}\s\w{3,}/.test(original.replace(/[#@]\S+/g, ''))) continue; // reine Hashtag-Zeilen
    let l = _kbStripLine(original.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' '));
    if (!l) continue;

    const p = l.match(/(?:für|for|ergibt|reicht für|serves)\s*:?\s*(\d+)\s*(person(?:en)?|portion(?:en)?|pers\.?|servings?|people|stück)/i);
    if (p && !portionen) portionen = +p[1];
    const z = l.match(/(?:zeit|dauer|fertig in|ready in|zubereitungszeit|gesamtzeit)\D{0,15}(\d+)\s*(min|minuten|std|stunden?)/i);
    if (z && !zeit) zeit = /std|stunde/i.test(z[2]) ? +z[1] * 60 : +z[1];

    const ohneDoppelpunkt = l.replace(/[:：]\s*$/, '');
    if (_KB_H_ZUT.test(ohneDoppelpunkt) && l.length < 60) {
      modus = 'zut';
      const rest = l.replace(_KB_H_ZUT, '').replace(/^[^:]*:\s*/, '').trim();
      if (rest && rest.length > 2 && !/^(personen|portionen)/i.test(rest)) rest.split(/,\s*(?=\d)/).forEach(x => zutaten.push(x));
      continue;
    }
    if (_KB_H_ZUB.test(ohneDoppelpunkt) && l.length < 60) {
      modus = 'zub';
      const rest = l.replace(_KB_H_ZUB, '').replace(/^[^:]*:\s*/, '').trim();
      if (rest.length > 15) schritte.push(rest);
      continue;
    }
    // Unterüberschriften wie "Für die Soße:" überspringen
    if (/[:：]$/.test(l) && l.length < 40) continue;

    const nummer = /^\d+[.)]\s+\S/.test(original.replace(/^[^\p{N}]*/u, '')) && !/^\d+[.)]\s*(g|kg|ml|l|el|tl)\b/i.test(l);
    const istMenge = _KB_MENGE.test(l) && l.length <= 70 && !/[.!?]\s+\S.*[.!?]$/.test(l);

    if (modus === 'zub' || (nummer && l.length > 25) || (zutaten.length >= 2 && !istMenge && l.length > 45)) {
      if (modus !== 'zub' && zutaten.length >= 2) modus = 'zub';
      if (modus === 'zub' || nummer) { schritte.push(l.replace(/^\d+[.)]\s*/, '')); continue; }
    }
    if (modus === 'zut' || istMenge) {
      if (l.length <= 90) { zutaten.push(l); continue; }
    }
    if (!titel && l.length >= 3) {
      const kurz = l.split(/\s[–—-]\s|[!?|]\s*|\.\s/)[0].trim();
      titel = (kurz.length >= 6 ? kurz : l).slice(0, 70);
      continue;
    }
    if (!beschreibung && l.length > 30 && !zutaten.length) beschreibung = l.slice(0, 220);
  }

  const zutatenRaw = zutaten.map(x => x.replace(/^[-–•*]\s*/, '').trim()).filter(x => x && x.length < 90);
  if (zutatenRaw.length < 2) return null;
  return _kbFinish({
    titel: titel || 'Importiertes Rezept',
    beschreibung,
    portionen,
    zeit,
    zutatenRaw,
    schritte,
  });
}

/* ───────────── Gemeinsamer Abschluss: Zutaten zerlegen, Ernährung & Art erkennen ───────────── */

const _KB_FLEISCH = /(fleisch(?!tomate)|hähnchen|hühnchen|huhn|hühner|pute|truthahn|rind|schwein|speck|schinken|salami|wurst|würstchen|hack|lamm|kalb|ente|gans|bacon|chorizo|prosciutto|pancetta|fisch|lachs|thunfisch|garnele|shrimp|krabbe|sardelle|anchovi|forelle|kabeljau|muschel|tintenfisch|gelatine|chicken|beef|pork|tuna|salmon)/i;
const _KB_TIER = /(milch|butter|sahne|käse|quark|joghurt|jogurt|schmand|mozzarella|parmesan|feta|halloumi|\bei\b|\beier|eigelb|eiweiß|honig|crème|creme fra|mascarpone|ricotta|ghee|skyr|burrata|egg|cheese|cream|yogurt|honey)/i;
const _KB_PFLANZLICH = /(hafer|soja|mandel|reis|kokos|pflanz|vegan|erbsen|cashew|dinkel)/i;

function _kbFinish(r) {
  const zutaten = (r.zutatenRaw || []).map(raw => {
    const p = _parseIngredientBrowser(raw);
    let name = (p.name || raw).replace(/^(?:g|kg|ml|l)\s+/i, '').replace(/^(?:stück|stk\.?)\s+/i, '').replace(/\s+(oder|or)\s+.*$/i, '').trim();
    let einheit = p.amount != null ? (p.unit || null) : null;
    // ausgeschriebene Einheiten ("1 Liter Brühe", "2 Esslöffel Öl") nachträglich erkennen
    const ausg = name.match(/^(liter|litern|milliliter|gramm|kilogramm|kilo|esslöffel|teelöffel|tl\.|el\.|cups?|tablespoons?|teaspoons?)\s+(.+)$/i);
    if (ausg && p.amount != null) {
      einheit = { liter: 'l', litern: 'l', milliliter: 'ml', gramm: 'g', kilogramm: 'kg', kilo: 'kg', esslöffel: 'EL', teelöffel: 'TL', 'tl.': 'TL', 'el.': 'EL', cup: 'Tasse', cups: 'Tassen', tablespoon: 'EL', tablespoons: 'EL', teaspoon: 'TL', teaspoons: 'TL' }[ausg[1].toLowerCase()] || einheit;
      name = ausg[2];
    }
    return { name: name.charAt(0).toUpperCase() + name.slice(1), menge: p.amount ?? null, einheit };
  }).filter(z => z.name && z.name.length > 1);

  const alle = zutaten.map(z => z.name).join(' | ');
  const kw = (r._kw || '') + ' ' + (r.titel || '');
  const tags = [];
  const fleisch = zutaten.some(z => _KB_FLEISCH.test(z.name));
  const tierisch = zutaten.some(z => _KB_TIER.test(z.name) && !_KB_PFLANZLICH.test(z.name));
  if (/vegan/i.test(kw) || (!fleisch && !tierisch)) tags.push('vegan', 'vegetarisch');
  else if (/vegetari/i.test(kw) || !fleisch) tags.push('vegetarisch');
  if (/glutenfrei|gluten-free|ohne gluten/i.test(kw)) tags.push('glutenfrei');

  const t = (r.titel || '') + ' ' + (r._kw || '');
  const typ = /suppe|eintopf|soup|stew/i.test(t) ? 'suppe'
    : /salat|salad|bowl/i.test(t) ? 'salat'
    : /kuchen|torte|muffin|brownie|cookie|keks|dessert|pudding|eis\b|crumble|tiramisu|waffel|cake/i.test(t) ? 'dessert'
    : /frühstück|porridge|overnight|müsli|granola|pancake|pfannkuchen|smoothie|breakfast/i.test(t) ? 'fruehstueck'
    : 'hauptgericht';
  const emoji = /suppe|soup/i.test(t) ? '🍲' : /curry/i.test(t) ? '🍛' : /salat|salad/i.test(t) ? '🥗'
    : /pasta|nudel|spaghetti|lasagne|penne|gnocchi/i.test(t) ? '🍝' : /pizza|flammkuchen/i.test(t) ? '🍕'
    : /kuchen|torte|cake|muffin/i.test(t) ? '🍰' : /brot|bread|toast/i.test(t) ? '🍞' : /burger/i.test(t) ? '🍔'
    : /bowl/i.test(t) ? '🥙' : /pfannkuchen|pancake|waffel/i.test(t) ? '🥞' : /smoothie/i.test(t) ? '🥤'
    : /kürbis/i.test(alle + t) ? '🎃' : '🍽️';

  return {
    titel: (r.titel || 'Importiertes Rezept').slice(0, 90),
    beschreibung: r.beschreibung || null,
    emoji,
    bild: r.bild || null,
    zeit: r.zeit && r.zeit < 1440 ? r.zeit : null,
    portionen: r.portionen && r.portionen < 50 ? r.portionen : 2,
    tags,
    typ,
    zutaten,
    schritte: (r.schritte || []).slice(0, 40),
    quelle: r.quelle || null,
    quelleName: r.quelleName || null,
  };
}


/* ══════════════════════════════════════════════════════════════════
   EIGENE ICONS FÜR OBST & GEMÜSE
   produkt-icons.svg enthält für jedes Produkt aus saisondaten3.json ein
   Symbol (#pi-<id>). Die Datei wird einmal geladen und in die Seite eingefügt;
   angezeigt wird ein Icon über <svg><use href="#pi-<id>"></svg>.
   ══════════════════════════════════════════════════════════════════ */
const PI_IDS = new Set(["apfel", "birne", "quitte", "aprikose", "kirsche", "mirabelle", "pfirsich", "pflaume", "brombeere", "erdbeere", "heidelbeere", "himbeere", "johannisbeere", "stachelbeere", "tafeltraube", "eisbergsalat", "endiviensalat", "feldsalat", "kopfsalat", "radicchio", "romanasalat", "rucola", "blumenkohl", "brokkoli", "chinakohl", "gruenkohl", "rosenkohl", "rotkohl", "spitzkohl", "weisskohl", "wirsing", "kohlrabi", "moehre", "pastinake", "rote_bete", "sellerie_knolle", "radieschen", "rettich", "kartoffel", "zwiebel", "lauch", "gurke", "kuerbis", "tomate", "zucchini", "zuckermais", "paprika", "aubergine", "bohne", "erbse", "champignon", "fenchel", "mangold", "rhabarber", "sellerie_stange", "spargel", "spinat", "orange", "limette", "mango", "schwarzwurzel", "steckruebe", "butterruebe", "topinambur", "zuckerschote", "fruehlingszwiebel", "avocado", "banane", "ananas", "kiwi", "grapefruit", "nektarine", "wassermelone", "melone", "feige", "kaki", "granatapfel", "passionsfrucht", "papaya", "physalis", "cranberry", "dattel", "cherimoya", "sauerkirsche", "kaktusfeige", "litchi", "pitahaya", "eberesche", "hagebutte", "holunderbeere", "sanddorn", "schlehe", "preiselbeere", "kornelkirsche", "artischocke", "chicoree", "kichererbse", "kiwano", "loewenzahn", "maniok", "okra", "pak_choi", "portulak", "schalotte", "wasserspinat", "batavia_salat", "eichblattsalat", "lollo_rosso", "herbstruebe", "mairuebe", "teltower_ruebchen", "gartenkresse", "brunnenkresse", "kerbelruebe", "zitrone", "mandarine", "suesskartoffel", "knoblauch", "wurzelpetersilie"]);

(function piLoadSprite() {
  fetch('produkt-icons.svg?v=20261119a')
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(t => {
      if (typeof _stripDevServerInjection === 'function') t = _stripDevServerInjection(t);
      const box = document.createElement('div');
      box.innerHTML = t;
      const svg = box.querySelector('svg');
      if (svg) { svg.id = 'pi-sprite'; document.body.prepend(svg); }
    })
    .catch(e => console.warn('Produkt-Icons konnten nicht geladen werden:', e));
})();

function produktIcon(id, cls) {
  if (!id || !PI_IDS.has(id)) return '';
  return `<svg class="pi${cls ? ' ' + cls : ''}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#pi-${id}"></use></svg>`;
}

// Überall, wo app.js bisher das Emoji eines Produkts zeigt, erscheint jetzt das eigene Icon.
const _piOrigEmoji = _getProduktEmoji;
window._getProduktEmoji = function (p) {
  return (p && produktIcon(p.id)) || _piOrigEmoji(p);
};


/* ══════════════════════════════════════════════════════════════════
   SCAN: DATENABRUF ÜBER EIGENES BACKEND (api/scan.php) MIT FALLBACK
   ──────────────────────────────────────────────────────────────────
   1. api/scan.php?ean=… – PHP-Backend mit JSON-Cache, Open Food Facts und Preisen
      (Antwort im OFF-Format {status, product} + prices, price_summary, sustainability).
   2. Ist kein Backend erreichbar (z. B. GitHub Pages oder Live Server, die kein PHP
      ausführen), fragt die App wie bisher direkt Open Food Facts und zusätzlich
      Open Prices ab und berechnet die Preis-Übersicht im Browser.
   Die Adresse des Backends lässt sich über window.SAISONOVO_API_BASE festlegen.
   ══════════════════════════════════════════════════════════════════ */
const SCAN_API_BASE = (typeof window.SAISONOVO_API_BASE === 'string' ? window.SAISONOVO_API_BASE : 'api/');
let _scanBackendDown = false;   // nach einem Fehlversuch in dieser Sitzung direkt den Fallback nutzen

const _SCAN_MSG = {
  invalid_ean: 'Dieser Code ist keine gültige EAN. Bitte erneut scannen oder die Ziffern prüfen.',
  not_found: '✦ Dieses Produkt ist noch nicht in Open Food Facts erfasst. Scanne ein anderes Produkt oder starte den Scanner neu.',
  offline: '⚠️ Keine Verbindung zur Produktdatenbank. Bitte Internetverbindung prüfen und erneut scannen.',
  timeout: '⚠️ Die Produktdatenbank antwortet gerade nicht. Bitte gleich noch einmal scannen.',
};

function _eanValid(code) {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const d = code.split('').map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((a, v, i) => a + v * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

async function _fetchJson(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : null;
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

async function scanLookup(rawCode) {
  const code = String(rawCode || '').replace(/[\s-]/g, '');

  // 1. Eigenes Backend
  if (!_scanBackendDown && SCAN_API_BASE) {
    try {
      const { res, data } = await _fetchJson(`${SCAN_API_BASE}scan.php?ean=${encodeURIComponent(code)}`, 20000);
      if (data && data.status === 1 && data.product) {
        return { product: data.product, via: 'backend', cache: data.cache || null, warnings: data.warnings || [] };
      }
      if (data && data.error) {
        if (data.error.code === 'invalid_ean') return { error: 'invalid_ean', message: _SCAN_MSG.invalid_ean };
        if (data.error.code === 'not_found') return { error: 'not_found', message: _SCAN_MSG.not_found };
        // upstream_* / internal → direkt aus dem Browser versuchen
      } else if (!data) {
        _scanBackendDown = true;   // z. B. PHP-Datei wird als Text ausgeliefert oder 404-Seite
      }
      void res;
    } catch (e) {
      _scanBackendDown = true;     // nicht erreichbar / Zeitüberschreitung
    }
  }

  // 2. Direkt aus dem Browser
  if (!_eanValid(code)) return { error: 'invalid_ean', message: _SCAN_MSG.invalid_ean };
  try {
    const offFields = typeof OFF_FIELDS === 'string'
      ? OFF_FIELDS + ',ecoscore_score,labels_tags,packaging_materials_tags,packaging_tags,nova_group,ingredients_text_de'
      : '';
    const [off, prices] = await Promise.all([
      _fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${offFields}`, 12000),
      _scanFetchOpenPrices(code).catch(() => null),
    ]);
    if (off.res.status === 404 || (off.data && off.data.status === 0)) {
      return { error: 'not_found', message: _SCAN_MSG.not_found };
    }
    if (!off.res.ok || !off.data?.product) throw new Error('HTTP ' + off.res.status);
    const product = off.data.product;
    if (prices) {
      product.prices = prices;
      product.price_summary = scanPriceSummary(prices);
    }
    product.sustainability = scanSustainability(product);
    return { product, via: 'direct', cache: null, warnings: prices ? [] : ['Preise konnten nicht geladen werden.'] };
  } catch (e) {
    console.error('Produktabfrage:', e);
    return { error: 'offline', message: e?.name === 'AbortError' ? _SCAN_MSG.timeout : _SCAN_MSG.offline };
  }
}

// Gleiches Preisformat wie das PHP-Backend (OpenPricesSource)
async function _scanFetchOpenPrices(code) {
  const { res, data } = await _fetchJson(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(code)}&order_by=-date&size=50`, 8000);
  if (!res.ok || !data) throw new Error('Open Prices HTTP ' + res.status);
  const kind = { RECEIPT: 'receipt', PRICE_TAG: 'price_tag', SHOP_IMPORT: 'catalog' };
  return (data.items || []).filter(i => typeof i.price === 'number').map(i => ({
    source: 'open_prices', source_id: String(i.id ?? ''), price: i.price, currency: i.currency || '',
    date: i.date || '', is_discounted: !!i.price_is_discounted, price_without_discount: i.price_without_discount ?? null,
    price_per: i.price_per ?? null, store: i.location?.osm_brand || i.location?.osm_name || null,
    city: i.location?.osm_address_city || null, postcode: i.location?.osm_address_postcode || null,
    country_code: i.location?.osm_address_country_code || null, kind: kind[i.proof?.type] || 'community',
  }));
}

// Entspricht Saisonovo\Service\PriceSummary (PHP)
function scanPriceSummary(prices, country = 'DE', currency = 'EUR', maxAgeDays = 365) {
  const cutoff = new Date(Date.now() - maxAgeDays * 864e5).toISOString().slice(0, 10);
  const recent = prices.filter(p => p.currency === currency && (p.date || '') >= cutoff && p.price_per == null);
  if (!recent.length) return null;
  const local = recent.filter(p => (p.country_code || '').toUpperCase() === country);
  const use = local.length ? local : recent;
  const vals = use.map(p => p.price).sort((a, b) => a - b);
  const n = vals.length;
  const median = n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
  const latest = [...use].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const r2 = v => Math.round(v * 100) / 100;
  return {
    currency, scope: local.length ? country : 'all', count: n,
    min: r2(vals[0]), max: r2(vals[n - 1]), median: r2(median), avg: r2(vals.reduce((a, b) => a + b, 0) / n),
    latest: { price: latest.price, date: latest.date, store: latest.store, city: latest.city, source: latest.source },
    sources: [...new Set(use.map(p => p.source))], since: cutoff,
  };
}

// Entspricht ProductService::sustainability (PHP)
function scanSustainability(p) {
  const clean = t => (Array.isArray(t) ? t : []).map(x => String(x).replace(/^[a-z]{2}:/, ''));
  const labels = clean(p.labels_tags);
  const g = String(p.ecoscore_grade || '').toLowerCase();
  return {
    ecoscore_grade: ['a-plus', 'a', 'b', 'c', 'd', 'e', 'f'].includes(g) ? g : null,
    ecoscore_score: typeof p.ecoscore_score === 'number' ? p.ecoscore_score : null,
    nutriscore_grade: /^[a-e]$/.test(String(p.nutriscore_grade || '')) ? p.nutriscore_grade : null,
    nova_group: typeof p.nova_group === 'number' ? p.nova_group : null,
    organic: labels.some(l => ['organic', 'eu-organic', 'de-bio-siegel', 'bio'].includes(l)),
    labels,
    packaging: clean(p.packaging_materials_tags).length ? clean(p.packaging_materials_tags) : clean(p.packaging_tags),
    packaging_recycling: clean(p.packaging_recycling_tags),
  };
}

/* ───────────── Anzeige: Preise & Nachhaltigkeit in der Scan-Karte ───────────── */

const _SCAN_LAND = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', FR: 'Frankreich', BE: 'Belgien', NL: 'Niederlande', IT: 'Italien', ES: 'Spanien', PL: 'Polen', LU: 'Luxemburg' };
const _SCAN_TAG_DE = {
  'organic': 'Bio', 'eu-organic': 'EU-Bio', 'bio-siegel': 'Bio-Siegel', 'de-bio-siegel': 'Bio-Siegel', 'fair-trade': 'Fairtrade', 'fairtrade-international': 'Fairtrade',
  'vegan': 'Vegan', 'vegetarian': 'Vegetarisch', 'no-gluten': 'Glutenfrei', 'rainforest-alliance': 'Rainforest Alliance', 'msc-sustainable-fishing': 'MSC',
  'asc': 'ASC', 'demeter': 'Demeter', 'bioland': 'Bioland', 'naturland': 'Naturland', 'ohne-gentechnik': 'Ohne Gentechnik', 'green-dot': 'Grüner Punkt',
  'glass': 'Glas', 'clear-glass': 'Glas', 'green-glass': 'Glas', 'brown-glass': 'Glas', 'plastic': 'Kunststoff', 'paper': 'Papier', 'cardboard': 'Pappe',
  'non-corrugated-cardboard': 'Pappe', 'corrugated-cardboard': 'Wellpappe', 'metal': 'Metall', 'aluminium': 'Aluminium', 'steel': 'Stahl', 'tetra-pak': 'Getränkekarton',
  'pp-5-polypropylene': 'PP-Kunststoff', 'pet-1-polyethylene-terephthalate': 'PET', 'hdpe-2-high-density-polyethylene': 'HDPE', 'ldpe-4-low-density-polyethylene': 'LDPE',
};
const _scanTag = t => _SCAN_TAG_DE[String(t).toLowerCase()] || String(t).replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
const _eur = (v, cur = 'EUR') => (typeof v === 'number' ? v : Number(v)).toLocaleString('de-DE', { style: 'currency', currency: cur || 'EUR' });
const _datum = d => (d ? new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

function scanRenderEnrichment(product, result) {
  let box = document.getElementById('scan-enrich');
  const anchor = document.getElementById('scan-success-message');
  if (!box && anchor) {
    box = document.createElement('div');
    box.id = 'scan-enrich';
    anchor.parentNode.insertBefore(box, anchor);
  }
  if (!box) return;
  if (!product) { box.innerHTML = ''; return; }

  const sum = product.price_summary;
  const prices = Array.isArray(product.prices) ? product.prices : [];
  const esc = typeof _gmEsc === 'function' ? _gmEsc : (x => String(x ?? ''));
  let preisHtml;
  if (sum) {
    const range = sum.min === sum.max ? _eur(sum.min, sum.currency) : `${_eur(sum.min, sum.currency)} – ${_eur(sum.max, sum.currency)}`;
    const wo = sum.scope === 'all' ? 'aus verschiedenen Ländern' : `aus ${_SCAN_LAND[sum.scope] || sum.scope}`;
    const liste = prices
      .filter(p => p.currency === sum.currency && (sum.scope === 'all' || (p.country_code || '').toUpperCase() === sum.scope) && (p.date || '') >= sum.since && p.price_per == null)
      .slice(0, 3)
      .map(p => `<li><span>${esc([p.store, p.city].filter(Boolean).join(', ') || 'Markt unbekannt')}<small>${_datum(p.date)}${p.is_discounted ? ' · Angebot' : ''}</small></span><b>${_eur(p.price, p.currency)}</b></li>`).join('');
    preisHtml = `
      <div class="scan-price-top"><span class="scan-enrich-label">Preis</span><span class="scan-price-range">${range}</span></div>
      <div class="scan-price-sub">Ø ${_eur(sum.median, sum.currency)} · ${sum.count} ${sum.count === 1 ? 'Meldung' : 'Meldungen'} ${wo} im letzten Jahr</div>
      ${liste ? `<ul class="scan-price-list">${liste}</ul>` : ''}`;
  } else if (prices.length) {
    const p = prices[0];
    preisHtml = `
      <div class="scan-price-top"><span class="scan-enrich-label">Preis</span><span class="scan-price-range">${_eur(p.price, p.currency)}</span></div>
      <div class="scan-price-sub">Letzte Meldung vom ${_datum(p.date)}${p.store ? ' · ' + esc(p.store) : ''}${p.country_code ? ' (' + esc(p.country_code) + ')' : ''} – älter als ein Jahr</div>`;
  } else {
    preisHtml = `
      <div class="scan-price-top"><span class="scan-enrich-label">Preis</span><span class="scan-price-none">noch keine Daten</span></div>
      <div class="scan-price-sub">Für dieses Produkt wurden noch keine Preise gemeldet.</div>`;
  }

  const n = product.sustainability || {};
  const chips = [
    ...(n.organic ? ['Bio'] : []),
    ...(n.labels || []).map(_scanTag).filter(l => l !== 'Bio' && !/^[a-z]{2}:/.test(l)).slice(0, 4),
  ];
  const pack = [...new Set((n.packaging || []).map(_scanTag))].slice(0, 4);
  const nova = n.nova_group ? `<span class="scan-chip scan-chip--nova">NOVA ${n.nova_group}</span>` : '';
  const nachhaltig = (chips.length || pack.length || nova) ? `
      <div class="scan-enrich-sep"></div>
      ${chips.length ? `<div class="scan-enrich-row"><span class="scan-enrich-label">Siegel</span><span class="scan-chips">${chips.map(c => `<span class="scan-chip">${esc(c)}</span>`).join('')}</span></div>` : ''}
      ${pack.length ? `<div class="scan-enrich-row"><span class="scan-enrich-label">Verpackung</span><span class="scan-chips">${pack.map(c => `<span class="scan-chip scan-chip--pack">${esc(c)}</span>`).join('')}</span></div>` : ''}
      ${nova ? `<div class="scan-enrich-row"><span class="scan-enrich-label">Verarbeitung</span><span class="scan-chips">${nova}</span></div>` : ''}` : '';

  const stand = result?.cache?.prices_fetched_at ? new Date(result.cache.prices_fetched_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const quelle = `Preise: Open Prices (Community)${stand ? ' · Stand ' + stand : ''}${result?.cache?.stale ? ' · ältere Daten' : ''}`;

  box.innerHTML = `<div class="scan-enrich">${preisHtml}${nachhaltig}<div class="scan-enrich-src">${quelle}</div></div>`;
}

// Bei PLU- oder Namenssuche gibt es keine EAN-Preise → Block leeren
['applyPluLookup', 'applyPluResult'].forEach(fn => {
  const orig = window[fn];
  if (typeof orig === 'function') {
    window[fn] = function (...args) { scanRenderEnrichment(null); return orig.apply(this, args); };
  }
});

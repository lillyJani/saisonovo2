const tabContent = document.getElementById('tab-content');
const onboardingContent = document.getElementById('onboarding-content');
const app = document.getElementById('app');

const tabFiles = {
  home: 'tabs/home.html',
  scan: 'tabs/scan.html',
  season: 'tabs/season.html',
  list: 'tabs/list.html',
  profile: 'tabs/profile.html',
};

let listItems = JSON.parse(localStorage.getItem('gruenkorb-list') || '[]');

// Country name → 2-letter abbreviation for display
const LAND_ABBR = {
  'Deutschland': 'DE', 'Spanien': 'ES', 'Niederlande': 'NL',
  'Frankreich': 'FR', 'Italien': 'IT', 'Polen': 'PL',
  'Österreich': 'AT', 'Belgien': 'BE', 'Portugal': 'PT',
  'Neuseeland': 'NZ', 'Suedafrika': 'ZA', 'Marokko': 'MA',
  'Peru': 'PE', 'Brasilien': 'BR', 'Indien': 'IN',
  'Türkei': 'TR', 'Israel': 'IL', 'Kenia': 'KE',
  'Chile': 'CL', 'Argentinien': 'AR', 'Ägypten': 'EG',
  'China': 'CN', 'Kolumbien': 'CO', 'Mexiko': 'MX',
  'Griechenland': 'GR', 'Schweden': 'SE', 'Dänemark': 'DK',
  'Ungarn': 'HU', 'Rumänien': 'RO', 'Serbien': 'RS',
  'Mittelmeerlaender': 'Med.', 'Tropen_und_Subtropen': 'Trop.', 'Osteuropa': 'OEU',
};

// Common synonyms and plural forms → saisondaten product ID
const PRODUKT_ALIASE = {
  // Möhre / Karotte
  'karotte': 'moehre', 'karotten': 'moehre', 'möhren': 'moehre', 'möhre': 'moehre',
  // Mais
  'mais': 'zuckermais', 'maiskolben': 'zuckermais',
  // Beeren
  'blaubeere': 'heidelbeere', 'blaubeeren': 'heidelbeere', 'heidelbeeren': 'heidelbeere',
  'weintraube': 'tafeltraube', 'weintrauben': 'tafeltraube', 'trauben': 'tafeltraube', 'traube': 'tafeltraube',
  // Pflaume
  'zwetschge': 'pflaume', 'zwetschgen': 'pflaume', 'pflaumen': 'pflaume',
  // Sellerie
  'knollensellerie': 'sellerie_knolle', 'sellerie': 'sellerie_knolle',
  'stangensellerie': 'sellerie_stange',
  // Lauch / Porree
  'porree': 'lauch', 'porrée': 'lauch',
  // Frühlingszwiebel
  'frühlingszwiebel': 'fruehlingszwiebel', 'frühlingszwiebeln': 'fruehlingszwiebel',
  'lauchzwiebel': 'fruehlingszwiebel', 'lauchzwiebeln': 'fruehlingszwiebel',
  // Rote Bete
  'randen': 'rote_bete', 'rote bete': 'rote_bete', 'rote beten': 'rote_bete',
  'rote beete': 'rote_bete', 'rote beeten': 'rote_bete',
  // Steckrübe
  'steckrübe': 'steckruebe', 'steckrüben': 'steckruebe',
  // Grünkohl
  'grünkohl': 'gruenkohl',
  // Tomaten-Varianten → Tomate
  'cherrytomaten': 'tomate', 'cherry-tomaten': 'tomate', 'kirschtomaten': 'tomate',
  'cocktailtomaten': 'tomate', 'rispentomaten': 'tomate', 'flaschentomaten': 'tomate',
  // Äpfel-Varianten → Apfel
  'äpfel': 'apfel',
  // Gurke
  'salatgurke': 'gurke', 'salatgurken': 'gurke', 'gurken': 'gurke',
  // Salatherzen → Romana-Salat (übliche Bezeichnung im Supermarkt für kleine Romana-Köpfe)
  'salatherzen': 'romanasalat', 'salatherz': 'romanasalat', 'romana-herzen': 'romanasalat',
  // Knoblauch
  'knoblauchzehe': 'knoblauch', 'knoblauchzehen': 'knoblauch',
  // Zwiebeln
  'zwiebeln': 'zwiebel', 'rote zwiebel': 'zwiebel', 'rote zwiebeln': 'zwiebel',
  'schalotten': 'schalotte',
  // Physalis / Kapstachelbeere
  'physalis': 'physalis', 'kapstachelbeere': 'physalis',
  // Fenchel
  'fenchelknolle': 'fenchel', 'fenchelknollen': 'fenchel',
  // Pilze
  'champignons': 'champignon', 'egerlinge': 'champignon',
  // Kürbis
  'kürbis': 'kuerbis', 'kürbisse': 'kuerbis', 'butternutkürbis': 'kuerbis', 'hokkaido': 'kuerbis',
  // Zucchini
  'zucchinis': 'zucchini',
  // Paprika
  'paprikaschote': 'paprika', 'paprikaschoten': 'paprika', 'paprikas': 'paprika',
  // Mandarine
  'clementine': 'mandarine', 'clementinen': 'mandarine', 'mandarinen': 'mandarine',
  // Erdbeeren
  'erdbeeren': 'erdbeere',
  // Himbeeren
  'himbeeren': 'himbeere',
  // Brombeeren
  'brombeeren': 'brombeere',
  // Kirsche
  'kirschen': 'kirsche',
  // Birnen
  'birnen': 'birne',
  // Bananen
  'bananen': 'banane',
  // Orangen
  'orangen': 'orange',
};

// PLU codes loaded from plu-codes.json
let _pluDaten = null;

let activeTab = '';

// Splashscreen: mindestens kurz sichtbar halten (kein Aufblitzen bei schnellem Laden),
// dann ausblenden sobald Onboarding bzw. Home-Tab fertig geladen sind.
function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('hide');
  setTimeout(() => { splash.remove(); _maybeShowInstallHint(); }, 400);
}

// Zeigt einen Hinweis, wie man die App zum Homescreen hinzufügt — nur im normalen
// Browser-Tab (nicht wenn schon als App installiert/geöffnet), nur auf iOS/Android,
// und nicht mehr, wenn er schon einmal weggeklickt wurde.
function _maybeShowInstallHint() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;
  if (localStorage.getItem('gruenkorb-install-hint-dismissed') === 'true') return;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  if (!isIOS && !isAndroid) return;

  // Browser-Erkennung: Reihenfolge wichtig, da z. B. Samsung Internet/Edge/Firefox
  // "Chrome" in ihrem User-Agent mitführen (Chromium-Basis) und sonst fälschlich
  // als Chrome erkannt würden.
  let steps;
  if (isIOS) {
    // Auf iOS läuft technisch jeder Browser über WebKit und die native Teilen-Funktion —
    // nur der Weg dorthin (Symbol direkt sichtbar vs. hinter einem Menü) unterscheidet sich.
    const hasDirectShareIcon = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua); // Safari
    const shareStep = hasDirectShareIcon
      ? '<li>Auf das Teilen-Symbol <i class="ti ti-share-2" aria-hidden="true"></i> tippen (untere Menüleiste)</li>'
      : '<li>Auf <strong>„…"</strong> bzw. das Menü tippen und <strong>„Teilen"</strong> auswählen</li>';
    steps = `${shareStep}
       <li>„Zum Home-Bildschirm" auswählen</li>
       <li>Oben rechts auf „Hinzufügen" tippen</li>`;
  } else if (/SamsungBrowser/.test(ua)) {
    steps = `<li>Unten auf das Menü-Symbol ☰ tippen</li>
       <li>„Seite zu" → „Startbildschirm" auswählen</li>
       <li>Bestätigen</li>`;
  } else if (/EdgA/.test(ua)) {
    steps = `<li>Unten auf die drei Punkte „…" tippen</li>
       <li>„Zu Telefon hinzufügen" bzw. „App installieren" auswählen</li>
       <li>Bestätigen</li>`;
  } else if (/Firefox/.test(ua)) {
    steps = `<li>Oben rechts auf die drei Punkte tippen</li>
       <li>„Installieren" bzw. „Zur Startseite hinzufügen" auswählen</li>
       <li>Bestätigen</li>`;
  } else if (/OPR/.test(ua)) {
    steps = `<li>Unten auf das Opera-Symbol bzw. Menü tippen</li>
       <li>„Zum Startbildschirm hinzufügen" auswählen</li>
       <li>Bestätigen</li>`;
  } else {
    // Chrome und andere Chromium-Standardbrowser
    steps = `<li>Oben rechts auf die drei Punkte tippen</li>
       <li>„App installieren" bzw. „Zum Startbildschirm hinzufügen" auswählen</li>
       <li>Bestätigen</li>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'install-hint-overlay';
  overlay.id = 'install-hint-overlay';
  overlay.innerHTML = `
    <div class="install-hint-sheet">
      <button class="install-hint-close" onclick="_dismissInstallHint()" aria-label="Schließen">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
      <img src="icon-512.png" alt="" class="install-hint-logo">
      <h3>Saisonovo als App installieren</h3>
      <p class="sub">Für das beste Erlebnis – ohne Adressleiste, direkt vom Homescreen.</p>
      <ol class="install-hint-steps">${steps}</ol>
      <button class="btn-primary" onclick="_dismissInstallHint()">Verstanden</button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) _dismissInstallHint(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function _dismissInstallHint() {
  localStorage.setItem('gruenkorb-install-hint-dismissed', 'true');
  const overlay = document.getElementById('install-hint-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}
const _splashMinDelay = new Promise(resolve => setTimeout(resolve, 500));

// Check if onboarding is already done
const onboardingDone = localStorage.getItem('gruenkorb-onboarding-done') === 'true';

if (onboardingDone) {
  // Skip onboarding and start the app directly
  app.classList.remove('onboarding');
  Promise.all([showScreen('home'), _splashMinDelay]).then(hideSplash).catch(hideSplash);
} else {
  // Load onboarding normally
  Promise.all([loadOnboarding(), _splashMinDelay]).then(hideSplash).catch(hideSplash);
}

// VS Code "Live Server" fügt in JEDE ausgelieferte HTML-Datei ein Nachlade-Skript ein – bei
// unseren Tab-Bausteinen (ohne </body>) landet es mitten in einem SVG-Symbol und zerschießt
// den Rest der Seite (z. B. fehlen in der Einkaufsliste dann Eingabefeld und Leer-Karte).
// Deshalb wird es hier vor dem Einsetzen entfernt. Ohne Live Server ändert das nichts.
function _stripDevServerInjection(html) {
  return html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '');
}

async function loadOnboarding() {
  try {
    const response = await fetch('tabs/onboarding.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('Onboarding konnte nicht geladen werden.');
    onboardingContent.innerHTML = _stripDevServerInjection(await response.text());
    renderOnboardingChallenges();
  } catch (error) {
    onboardingContent.innerHTML = `
      <div class="onboard-step active">
        <div class="card">
          <h2>Onboarding konnte nicht geladen werden</h2>
          <p class="sub">Starte die App über einen lokalen Server, damit die einzelnen HTML-Dateien geladen werden können.</p>
        </div>
      </div>
    `;
  }
}

function nextOb(step) {
  document.querySelectorAll('.onboard-step').forEach(stepEl => stepEl.classList.remove('active'));
  const el = document.getElementById('ob' + step);
  if (el) el.classList.add('active');
}

const _UNRESTRICTED_PILLS = ['Alles', 'Omnivoren'];

function togglePill(el) {
  const group = el.closest('.auswahl-gruppe');
  const text = el.textContent.trim();

  if (_UNRESTRICTED_PILLS.includes(text)) {
    // "Alles"/"Omnivoren" auswählen → alle anderen deaktivieren
    el.classList.toggle('aktiv');
    if (el.classList.contains('aktiv') && group) {
      group.querySelectorAll('.auswahl').forEach(p => {
        if (p !== el) p.classList.remove('aktiv');
      });
    }
  } else {
    // Spezifische Option → "Alles"/"Omnivoren" deaktivieren
    el.classList.toggle('aktiv');
    if (el.classList.contains('aktiv') && group) {
      group.querySelectorAll('.auswahl').forEach(p => {
        if (_UNRESTRICTED_PILLS.includes(p.textContent.trim())) p.classList.remove('aktiv');
      });
    }
  }
}

// Mehrfachauswahl (wie bei den Ernährungs-/Diät-Pills): beliebig viele Challenges
// oder gar keine — jede Option lässt sich einzeln an- und wieder abwählen.
function renderOnboardingChallenges() {
  const container = document.getElementById('onboard-challenge-options');
  if (!container) return;
  container.innerHTML = availableChallenges.map(challenge => `
    <div class="challenge-option" data-challenge-id="${challenge.id}" onclick="toggleOnboardingChallenge('${challenge.id}')">
      <div class="challenge-option-title">${challenge.icon} ${challenge.title}</div>
      <div class="challenge-option-desc">${challenge.description}</div>
    </div>
  `).join('');
}

function toggleOnboardingChallenge(challengeId) {
  const container = document.getElementById('onboard-challenge-options');
  if (!container) return;
  const target = container.querySelector(`.challenge-option[data-challenge-id="${challengeId}"]`);
  target?.classList.toggle('selected');
}

function _dietStartingPoints(diet) {
  if (diet.includes('Veganer') || diet.includes('Frutarier')) return 75;
  if (diet.includes('Vegetarier')) return 50;
  return 0;
}

function startApp(skipChallenges) {
  const name = document.getElementById('ob-name')?.value?.trim() || 'Benutzer';
  const avatar = name.charAt(0).toUpperCase();
  const diet = Array.from(document.querySelectorAll('#diet-pills .auswahl.aktiv')).map(p => p.textContent.trim());
  const finalDiet = diet.length > 0 ? diet : ['Alles'];
  const selectedChallengeIds = skipChallenges ? [] : Array.from(document.querySelectorAll('#onboard-challenge-options .challenge-option.selected'))
    .map(el => el.dataset.challengeId);

  const profileData = {
    avatar,
    name,
    diet: finalDiet,
    region: 'Deutschland',
    onboardingDate: new Date().toISOString()
  };

  localStorage.setItem('gruenkorb-profile', JSON.stringify(profileData));
  localStorage.setItem('gruenkorb-onboarding-done', 'true');
  saveChallenges(selectedChallengeIds);

  // Starting bonus based on diet
  const startPoints = _dietStartingPoints(finalDiet);
  if (startPoints > 0) {
    const score = { total: startPoints, swaps: 0, purchases: 0, dietBonus: startPoints };
    localStorage.setItem('gruenkorb-score', JSON.stringify(score));
  }

  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  app.classList.remove('onboarding');
  showScreen('home');
}

async function showScreen(name) {
  // Kochbuch ist jetzt Teil des Tabs "Saisonküche" (season) – alte Aufrufe umleiten
  if (name === 'kochbuch') {
    if (typeof KB !== 'undefined') KB.view = 'kochbuch';
    name = 'season';
  }
  if (!tabFiles[name]) return;

  if (activeTab === 'scan') stopScanner();
  activeTab = name;
  tabContent.classList.add('active');
  tabContent.innerHTML = '<div class="scroll-area"><p class="sub">Lädt...</p></div>';

  // Der Scanner hat keinen eigenen Menüpunkt mehr – er wird aus der Einkaufsliste geöffnet.
  const navName = name === 'scan' ? ((typeof window.scanFrom === 'string' && window.scanFrom) || 'list') : name;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === navName);
  });

  try {
    const response = await fetch(tabFiles[name], { cache: 'no-store' });
    if (!response.ok) throw new Error(`Tab ${name} konnte nicht geladen werden.`);
    tabContent.innerHTML = _stripDevServerInjection(await response.text());
  } catch (error) {
    tabContent.innerHTML = `
      <div class="scroll-area">
        <div class="card">
          <h2>Tab konnte nicht geladen werden</h2>
          <p class="sub">Starte die App über einen lokalen Server, damit die einzelnen HTML-Dateien geladen werden können.</p>
        </div>
      </div>
    `;
    return;
  }

  initTab(name);
}

function initTab(name) {
  if (name === 'scan') initScanTab();
  if (name === 'season') renderSeasonTab();
  if (name === 'list') renderList();
  if (name === 'home') {
    const profile = JSON.parse(localStorage.getItem('gruenkorb-profile') || '{}');
    const userName = profile.name && profile.name !== 'Benutzer' ? profile.name : '';
    const _now = new Date();
    const _mins = _now.getHours() * 60 + _now.getMinutes();
    const greetWord = _mins < 660 ? 'Guten Morgen' : _mins < 1050 ? 'Guten Tag' : 'Guten Abend';
    const greeting = document.getElementById('greeting');
    if (greeting) {
      greeting.textContent = userName ? `${greetWord}, ${userName}` : greetWord;
    }
    initChallengesOnHome();
    renderFoodProfileCard();
  }
  if (name === 'profile') {
    renderProfileView();
  }
  // Erweiterungen (Kochbuch, Gamification, Wirkung) – siehe features.js
  if (typeof gmInitTab === 'function') gmInitTab(name);
}


function addItem(value) {
  const input = document.getElementById('list-input');
  const text = (value || input?.value || '').trim();
  if (!text) return;
  if (input) input.value = '';

  let ampel = null, saisonText = null, produktId = null;
  const produkt = _matchSaisondatenByName(text);
  if (produkt && _saisondaten) {
    const score = _calculateSaisonScore(produkt, []);
    if (score) { ampel = score.ampel; saisonText = score.text; }
    produktId = produkt.id;
  }

  const newItem = { text, ampel, saisonText, produktId, done: false, id: Date.now(), qty: 1 };
  listItems.push(newItem);
  saveList();

  showScreen('list');
  showListItemDetails(newItem.id);
}

function saveList() {
  localStorage.setItem('gruenkorb-list', JSON.stringify(listItems));
}

function _buildAutocompleteItems(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];
  const qu = _deUmlaut(q);
  const results = [];
  const seen = new Set();

  const add = (name, emoji, source) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ name, emoji, source });
  };

  // saisondaten
  if (_saisondaten) {
    for (const p of _saisondaten.produkte) {
      const pn = _deUmlaut(p.name.toLowerCase());
      if (pn.startsWith(qu) || p.name.toLowerCase().startsWith(q)) {
        add(p.name, _getProduktEmoji(p), 'saison');
      }
    }
    for (const p of _saisondaten.produkte) {
      const pn = _deUmlaut(p.name.toLowerCase());
      if (!pn.startsWith(qu) && pn.includes(qu)) {
        add(p.name, _getProduktEmoji(p), 'saison');
      }
    }
  }

  // ernaehrung
  if (_ernaehrung) {
    for (const kat of Object.values(_ernaehrung)) {
      for (const p of kat) {
        const pn = _deUmlaut(p.name.toLowerCase());
        if (pn.startsWith(qu) || p.name.toLowerCase().startsWith(q)) {
          add(p.name, p.emoji || '🛒', 'ern');
        }
      }
    }
    for (const kat of Object.values(_ernaehrung)) {
      for (const p of kat) {
        for (const alias of (p.aliases || [])) {
          const an = _deUmlaut(alias.toLowerCase());
          if (an.startsWith(qu)) {
            // show canonical product name, not alias
            add(p.name, p.emoji || '🛒', 'ern');
          }
        }
      }
    }
  }

  return results.slice(0, 7);
}

function showAutocomplete(query) {
  const dropdown = document.getElementById('autocomplete-list');
  if (!dropdown) return;
  const items = _buildAutocompleteItems(query);
  if (!items.length || !query.trim()) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    return;
  }
  dropdown.innerHTML = items.map((item, i) =>
    `<div class="autocomplete-item" onmousedown="selectAutocomplete('${item.name.replace(/'/g, "\\'")}')" data-idx="${i}">
      <span class="autocomplete-emoji">${item.emoji}</span>
      <span class="autocomplete-name">${escapeHtml(item.name)}</span>
    </div>`
  ).join('');
  dropdown.classList.add('open');
}

function selectAutocomplete(name) {
  const input = document.getElementById('list-input');
  if (input) input.value = name;
  const dropdown = document.getElementById('autocomplete-list');
  if (dropdown) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }
  addItem(name);
}

function handleListInputKey(e) {
  if (e.key === 'Enter') {
    const dropdown = document.getElementById('autocomplete-list');
    if (dropdown) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }
    addItem();
  }
  if (e.key === 'Escape') {
    const dropdown = document.getElementById('autocomplete-list');
    if (dropdown) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }
  }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.list-input-wrap')) {
    const dropdown = document.getElementById('autocomplete-list');
    if (dropdown) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }
  }
});

function renderList() {
  const container = document.getElementById('list-items');
  const empty = document.getElementById('list-empty');
  const sub = document.getElementById('list-sub');

  if (!container || !empty || !sub) return;

  const countBadge = document.getElementById('list-count');
  const doneBtn = document.getElementById('shopping-done-btn');

  if (listItems.length === 0) {
    container.style.display = 'none';
    empty.style.display = 'block';
    sub.textContent = 'Deine Liste ist leer';
    if (countBadge) countBadge.textContent = '';
    if (doneBtn) doneBtn.style.display = 'none';
    return;
  }
  if (doneBtn) doneBtn.style.display = 'flex';

  const undone = listItems.filter(i => !i.done).reverse();
  const done   = listItems.filter(i =>  i.done).reverse();

  empty.style.display = 'none';
  container.style.display = 'block';
  sub.textContent = done.length ? `${undone.length} offen · ${done.length} erledigt` : `${listItems.length} Artikel`;
  if (countBadge) countBadge.textContent = listItems.length;

  const renderItem = item => {
    const produkt = item.produktId
      ? _saisondaten?.produkte.find(p => p.id === item.produktId)
      : _matchSaisondatenByName(item.text);
    const ernProdukt = !produkt ? _matchErnaehrung(item.text) : null;
    const emoji = produkt
      ? (_getProduktEmoji(produkt))
      : (ernProdukt?.emoji || '🛒');

    let badge = '';
    const a = item.ampel;
    if (a === 'gruen')      badge = '<span class="ampel-badge ampel-badge-gruen">In Saison</span>';
    else if (a === 'gelb')  badge = '<span class="ampel-badge ampel-badge-gelb">Bedingt</span>';
    else if (a === 'rot')   badge = '<span class="ampel-badge ampel-badge-rot">Außer Saison</span>';
    else if (item.warn)     badge = '<span class="warn-badge">nicht saisonal</span>';

    const qty = item.qty || 1;
    const qtyDisplay = item.amount != null
      ? `<span class="amount-badge" onclick="event.stopPropagation()">${_fmtAmount(item.amount * qty)} ${item.unit || ''}</span>`
      : `<span class="qty-badge" onclick="event.stopPropagation()">×${qty}</span>`;

    const swapOriginal = item.ecoSwap ? _getErnProduktById(item.ecoSwap.fromErnId) : null;
    const swapBadge = swapOriginal && !item.done
      ? `<span class="swap-from-badge" title="Alternative zu ${escapeHtml(swapOriginal.name)}">${swapOriginal.emoji} →</span>`
      : '';

    return `
    <div class="list-item${item.done ? ' list-item-done' : ''}" onclick="showListItemDetails(${item.id})" style="cursor:pointer">
      <button class="list-checkbox${item.done ? ' completed' : ''}" onclick="event.stopPropagation(); toggleDone(${item.id})" aria-label="${item.done ? 'Als offen markieren' : 'Als erledigt markieren'}"></button>
      <span class="list-item-emoji">${emoji}</span>
      <span class="list-item-text${item.done ? ' done' : ''}">${swapBadge}${escapeHtml(item.text)}${item.fromRecipe ? '<svg class=\"recipe-from-icon\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25\" /></svg>' : ''}</span>
      ${item.done ? '' : badge}
      ${item.done ? '' : qtyDisplay}
      <button class="icon-button" onclick="event.stopPropagation(); removeItem(${item.id})" aria-label="Entfernen"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
    </div>
    `;
  };

  const divider = done.length && undone.length
    ? `<div class="list-done-divider"><span>Erledigt (${done.length})</span></div>`
    : '';

  container.innerHTML = undone.map(renderItem).join('') + divider + done.map(renderItem).join('');
}

function showListItemDetails(itemId) {
  const item = listItems.find(entry => entry.id === itemId);
  if (!item) return;

  const produkt = item.produktId
    ? _saisondaten?.produkte.find(p => p.id === item.produktId)
    : _matchSaisondatenByName(item.text);

  const monat = new Date().getMonth() + 1;
  const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const ernProdukt = !produkt ? _matchErnaehrung(item.text) : null;
  const emoji = produkt
    ? (_getProduktEmoji(produkt))
    : (ernProdukt?.emoji || '🛒');

  if (!produkt) {
    const fuzzy = _fuzzyMatch(item.text);
    const fuzzyHtml = fuzzy.length ? `
      <div class="card" style="margin-top:0">
        <div class="detail-card-label">Meintest du…?</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${fuzzy.map(s => `<button class="suggestion-chip" onclick="applySuggestion(${item.id},'${escapeHtml(s.name)}')">${s.emoji ? s.emoji+' ' : ''}${escapeHtml(s.name)}</button>`).join('')}
        </div>
      </div>` : '';

    const ernCard = ernProdukt ? _buildErnaehrungCard(ernProdukt, item.id) : '';

    const swapOriginal = item.ecoSwap ? _getErnProduktById(item.ecoSwap.fromErnId) : null;
    const swapCard = swapOriginal ? `
      <div class="card swap-origin-card">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:28px">${swapOriginal.emoji}</span>
          <div>
            <div style="font-size:12px;color:var(--green-mid);font-weight:600;text-transform:uppercase;letter-spacing:0.04em">🌱 Bewusste Alternative</div>
            <div style="font-size:14px;color:var(--text);margin-top:2px">Statt <strong>${escapeHtml(swapOriginal.name)}</strong></div>
          </div>
        </div>
      </div>` : '';

    tabContent.innerHTML = `
      <div class="scroll-area">
        <button onclick="showScreen('list')" aria-label="Zurück" style="background:none;border:none;cursor:pointer;margin-bottom:16px;display:flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="font-size:56px">${emoji}</div>
          <div>
            <h1 style="margin-bottom:4px">${escapeHtml(item.text)}</h1>
            <div style="font-size:13px;color:var(--muted)">${ernProdukt ? ernProdukt.name : 'Kein Saisonbezug'}</div>
          </div>
        </div>
        ${ernProdukt ? _amountInputHtml(item) : ''}
        ${swapCard}
        ${ernCard}
        ${fuzzyHtml}
        <button class="btn-primary" style="width:100%;margin-top:16px" onclick="showScreen('list')">Zurück zur Liste</button>
        <div style="height:12px"></div>
      </div>`;
    return;
  }

  const saisonScore = _calculateSaisonScore(produkt, []);
  const regeln = _saisondaten?.bewertungsregeln || {};
  const dot = saisonScore ? { gruen: '🟢', gelb: '🟡', rot: '🔴' }[saisonScore.ampel] || '⚪' : '⚪';

  const { inCard, outCard } = _buildLaenderCards(produkt, monat, MN);

  const alternativen = _findeAlternativen(produkt.id);
  const alternativenHtml = alternativen.length ? `
    <div class="card">
      <div class="detail-card-label">Gerade in Saison (${produkt.kategorie.replace(/_/g,' ')})</div>
      ${alternativen.map(a => `
        <div class="detail-land-row" onclick="showFoodDetails('${a.id}')" style="cursor:pointer">
          <span class="detail-land-dot">${_getProduktEmoji(a)}</span>
          <span class="detail-land-name" style="color:var(--green-dark);font-weight:500">${a.name}</span>
          <span class="detail-land-phase" style="color:var(--green-dark)">🟢</span>
        </div>`).join('')}
    </div>` : '';

  const qty = item.qty || 1;
  const hasAmount = item.amount != null;
  const qtyLabel = hasAmount ? 'Portionen' : 'Menge';
  const totalAmountHtml = hasAmount
    ? `<div id="detail-total-amount" style="font-size:12px;color:var(--muted);text-align:right;margin-top:-10px;margin-bottom:14px">= ${_fmtAmount(item.amount * qty)} ${item.unit || ''} gesamt</div>`
    : '';

  tabContent.innerHTML = `
    <div class="scroll-area">
      <button onclick="showScreen('list')" aria-label="Zurück" style="background:none;border:none;cursor:pointer;margin-bottom:16px;display:flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:var(--s-md)">
        <div style="font-size:56px">${emoji}</div>
        <div>
          <h1 style="margin-bottom:4px">${produkt.name}</h1>
          <div style="font-size:var(--t-sm);color:var(--muted)">${produkt.kategorie.replace(/_/g, ' ')}</div>
          ${hasAmount ? `<div style="font-size:12px;color:var(--green-mid);margin-top:3px">Rezeptmenge: ${_fmtAmount(item.amount)} ${item.unit || ''}</div>` : ''}
        </div>
      </div>

      <div class="detail-qty-row">
        <span class="detail-qty-label">${qtyLabel}</span>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQtyFromDetail(${item.id}, -1)" aria-label="Weniger"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg></button>
          <span class="qty-num" id="detail-qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQtyFromDetail(${item.id}, +1)" aria-label="Mehr"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
        </div>
      </div>
      ${totalAmountHtml}
      ${_amountInputHtml(item)}

      ${inCard}
      ${outCard}

      <div class="card">
        <div class="detail-card-label">Saisonverlauf</div>
        ${_globalMonthGrid(produkt, monat)}
      </div>

      ${alternativenHtml}

      <button class="btn-primary" style="width:100%;margin-top:var(--s-md)" onclick="showScreen('list')">Zurück zur Liste</button>
      <div style="height:12px"></div>
    </div>`;
}

function toggleDone(id) {
  const item = listItems.find(entry => entry.id === id);
  if (!item) return;

  const becomingDone = !item.done;
  item.done = becomingDone;

  // Punkt vergeben wenn positive Alternative abgehakt wird (nur einmal)
  if (becomingDone && item.ecoSwap && !item.ecoSwapScored) {
    item.ecoSwapScored = true;
    const score = JSON.parse(localStorage.getItem('gruenkorb-score') || '{"total":0,"swaps":0,"purchases":0}');
    score.total  += 1;
    score.swaps  += 1;
    localStorage.setItem('gruenkorb-score', JSON.stringify(score));
    _showToast('🌱 +1 Punkt für deine Entscheidung!');
    _trackGoodDecision();
    updateChallengeProgress('eco-swaps', 1);
    if (typeof gmOnGoodChoice === 'function') gmOnGoodChoice();
  }

  saveList();
  renderList();
}

function removeItem(id) {
  const idx = listItems.findIndex(entry => entry.id === id);
  if (idx === -1) return;

  listItems.splice(idx, 1);
  saveList();
  renderList();
}

function changeQtyFromDetail(id, delta) {
  const item = listItems.find(e => e.id === id);
  if (!item) return;
  const newQty = (item.qty || 1) + delta;
  if (newQty <= 0) { removeItem(id); showScreen('list'); return; }
  item.qty = newQty;
  saveList();
  const numEl = document.getElementById('detail-qty-num');
  if (numEl) numEl.textContent = newQty;
  if (item.amount != null) {
    const totalEl = document.getElementById('detail-total-amount');
    if (totalEl) totalEl.textContent = `= ${_fmtAmount(item.amount * newQty)} ${item.unit || ''} gesamt`;
  }
}

// Lässt die Menge eines Artikels direkt in kg/L setzen (überschreibt Rezeptmenge/Standardportion)
function setItemAmountFromDetail(id, rawAmount, unit) {
  const item = listItems.find(e => e.id === id);
  if (!item) return;
  const amount = parseFloat(String(rawAmount).replace(',', '.'));
  if (!isNaN(amount) && amount > 0) {
    item.amount = amount;
    item.unit = unit;
  } else {
    item.amount = null;
    item.unit = null;
  }
  saveList();
}

// Rendert das kg/L-Mengenfeld in der Artikeldetailansicht (für Fußabdruck-Berechnung)
function _amountInputHtml(item) {
  const unit = item.unit === 'l' ? 'l' : 'kg';
  const value = (item.amount != null && (item.unit === 'kg' || item.unit === 'l')) ? item.amount : '';
  return `
    <div class="detail-qty-row">
      <span class="detail-qty-label">Menge anpassen</span>
      <div class="amount-input-control">
        <input type="number" step="0.05" min="0" inputmode="decimal" placeholder="z. B. 0,5"
          id="detail-amount-input-${item.id}"
          value="${value}"
          oninput="setItemAmountFromDetail(${item.id}, this.value, document.getElementById('detail-amount-unit-${item.id}').value)" />
        <select id="detail-amount-unit-${item.id}"
          onchange="setItemAmountFromDetail(${item.id}, document.getElementById('detail-amount-input-${item.id}').value, this.value)">
          <option value="kg" ${unit === 'kg' ? 'selected' : ''}>kg</option>
          <option value="l" ${unit === 'l' ? 'selected' : ''}>L</option>
        </select>
      </div>
    </div>`;
}

function renderSeasonTab() {
  const inEl  = document.getElementById('season-in');
  const outEl = document.getElementById('season-out');
  if (!inEl || !outEl) return;

  if (!_saisondaten) {
    setTimeout(renderSeasonTab, 500);
    return;
  }

  const monat = new Date().getMonth() + 1;
  const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const inItems = [], outItems = [];

  for (const produkt of _saisondaten.produkte) {
    const emoji = _getProduktEmoji(produkt);
    const score = _calculateSaisonScore(produkt, []);
    const deEintrag = produkt.laender.find(l => l.land === 'Deutschland');
    const deMonate = deEintrag
      ? [...new Set(deEintrag.phasen.flatMap(p => p.monate))].sort((a, b) => a - b)
      : [];

    // Countries active this month
    const activeCountries = produkt.laender
      .filter(l => _getPhaseForMonth(l, monat))
      .map(l => LAND_ABBR[l.land] || l.land.slice(0, 2).toUpperCase());

    const item = { produkt, emoji, score, activeCountries, deMonate, MN };
    if (score && (score.ampel === 'gruen' || score.ampel === 'gelb')) inItems.push(item);
    else outItems.push(item);
  }

  // Grün vor Gelb innerhalb "In Saison"
  inItems.sort((a, b) => {
    if (a.score?.ampel === b.score?.ampel) return 0;
    return a.score?.ampel === 'gruen' ? -1 : 1;
  });

  function renderItem({ produkt, emoji, score, activeCountries, deMonate, MN }) {
    const dot = score ? ({ gruen: '🟢', gelb: '🟡', rot: '🔴' }[score.ampel] || '🔴') : '🔴';
    const cls = score?.ampel === 'gruen' ? 'in-season' : score?.ampel === 'gelb' ? '' : 'not-in-season';
    const badges = activeCountries.slice(0, 3).map(c => `<span class="country-badge">${c}</span>`).join('');
    const isLager = score?.regelKey === 'regional_lager';
    let subContent = '';
    if (isLager) {
      subContent = `<span class="lager-sub-tag">Kühlhaus</span>`;
    } else if (deMonate.length) {
      subContent = `DE: ${deMonate.map(m => MN[m-1]).join(', ')}`;
    }
    const sub = subContent ? `<div class="food-sub">${subContent}</div>` : '';
    return `<div class="season-item ${cls}" onclick="showFoodDetails('${produkt.id}')" style="cursor:pointer">
      <div class="food-emoji">${emoji}</div>
      <div class="food-name">${produkt.name} ${dot}${sub}</div>
      <div class="countries">${badges}</div>
    </div>`;
  }

  inEl.innerHTML  = inItems.length  ? inItems.map(renderItem).join('')  : '<p class="sub" style="padding:12px">Aktuell nichts in Saison.</p>';
  outEl.innerHTML = outItems.map(renderItem).join('');
}

function filterSeason(q) {
  const rows = document.querySelectorAll('#season-in .season-item, #season-out .season-item');
  rows.forEach(row => {
    const name = row.querySelector('.food-name').textContent.toLowerCase();
    row.style.display = (!q || name.includes(q.toLowerCase())) ? '' : 'none';
  });
}

function showFoodDetails(produktId) {
  if (!_saisondaten) return;
  const produkt = _saisondaten.produkte.find(p => p.id === produktId);
  if (!produkt) return;

  const monat = new Date().getMonth() + 1;
  const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const emoji = _getProduktEmoji(produkt);
  const saisonScore = _calculateSaisonScore(produkt, []);
  const regeln = _saisondaten.bewertungsregeln;
  const dot = saisonScore ? { gruen: '🟢', gelb: '🟡', rot: '🔴' }[saisonScore.ampel] || '⚪' : '⚪';

  const { inCard: inCard2, outCard: outCard2 } = _buildLaenderCards(produkt, monat, MN);

  const alternativen2 = _findeAlternativen(produkt.id);
  const alternativenHtml2 = alternativen2.length ? `
    <div class="card">
      <div class="detail-card-label">Gerade in Saison (${produkt.kategorie.replace(/_/g,' ')})</div>
      ${alternativen2.map(a => `
        <div class="detail-land-row" onclick="showFoodDetails('${a.id}')" style="cursor:pointer">
          <span class="detail-land-dot">${_getProduktEmoji(a)}</span>
          <span class="detail-land-name" style="color:var(--green-dark);font-weight:500">${a.name}</span>
          <span class="detail-land-phase" style="color:var(--green-dark)">🟢</span>
        </div>`).join('')}
    </div>` : '';

  tabContent.innerHTML = `
    <div class="scroll-area">
      <button onclick="closeFoodDetails()" aria-label="Zurück" style="background:none;border:none;cursor:pointer;margin-bottom:16px;display:flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="24" height="24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:var(--s-md)">
        <div style="font-size:56px">${emoji}</div>
        <div>
          <h1 style="margin-bottom:4px">${produkt.name}</h1>
          <div style="font-size:var(--t-sm);color:var(--muted)">${produkt.kategorie.replace(/_/g, ' ')}</div>
        </div>
      </div>

      ${inCard2}
      ${outCard2}

      <div class="card">
        <div class="detail-card-label">Saisonverlauf</div>
        ${_globalMonthGrid(produkt, monat)}
      </div>

      ${alternativenHtml2}

      ${typeof kbFoodRecipesHtml === 'function' ? kbFoodRecipesHtml(produkt.id) : ''}

      <button class="btn-primary" style="width:100%;margin-top:var(--s-md)" onclick="addItem('${escapeHtml(produkt.name)}'); closeFoodDetails()">+ Zur Einkaufsliste</button>
      <div style="height:12px"></div>
    </div>`;
}

function closeFoodDetails() {
  showScreen(activeTab);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

// ===== Profile Functions =====

function loadProfileData() {
  const profileData = JSON.parse(localStorage.getItem('gruenkorb-profile') || '{"name":"Benutzer","avatar":"B","diet":["Alles"],"goals":["Saisonal kaufen","Weniger CO₂"],"region":"Deutschland"}');
  return profileData;
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('gruenkorb-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('gruenkorb-theme', 'dark');
  }
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) darkToggle.classList.toggle('on', !isDark);
}

function renderProfileView() {
  const profile = loadProfileData();
  const avatar = profile.avatar || profile.name.charAt(0).toUpperCase();

  document.getElementById('profile-avatar').textContent = avatar;
  document.getElementById('profile-name').textContent = profile.name;
  document.getElementById('profile-subtitle').textContent = profile.region + ', DE';

  // Verlauf (History)
  const score = JSON.parse(localStorage.getItem('gruenkorb-score') || '{"total":0,"swaps":0,"purchases":0,"challengesCompleted":0}');
  const challengesCompleted = score.challengesCompleted || 0;
  const totalActivity = score.swaps + score.purchases + challengesCompleted;
  const notes = [
    [1,  '🌱 Super Start! Jede Alternative zählt.'],
    [5,  '🌿 Du bist auf dem richtigen Weg!'],
    [10, '✨ Du machst einen echten Unterschied!'],
    [25, '🌍 Beeindruckend bewusst eingekauft!'],
    [50, '🏆 Du bist ein echtes Vorbild!'],
  ];
  const note = [...notes].reverse().find(([min]) => totalActivity >= min)?.[1] || '';

  const el = id => document.getElementById(id);
  if (el('score-swaps'))     el('score-swaps').textContent     = score.swaps;
  if (el('score-purchases')) el('score-purchases').textContent = score.purchases;
  if (el('score-challenges-completed')) el('score-challenges-completed').textContent = challengesCompleted;
  if (el('score-note'))      el('score-note').textContent      = note;

  // Diet pills
  const dietPillsEl = document.getElementById('profile-diet-pills');
  if (dietPillsEl) {
    const dietItems = (profile.diet && profile.diet.length > 0) ? profile.diet : ['Alles'];
    dietPillsEl.innerHTML = dietItems.map(d => `<span class="profile-diet-pill aktiv">${d}</span>`).join('');
  }

  // Dunkelmodus-Toggle
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) darkToggle.classList.toggle('on', document.documentElement.getAttribute('data-theme') === 'dark');

  // Challenges — weekly reset check, active first, collapsible
  checkWeeklyReset();
  const selectedChallengeIds = loadChallenges();
  const challengeProgress = loadChallengeProgress();
  const challengesContainer = document.getElementById('profile-challenges-view');
  if (challengesContainer) {
    const sorted = [...availableChallenges].sort((a, b) => {
      const aActive = selectedChallengeIds.includes(a.id) ? 0 : 1;
      const bActive = selectedChallengeIds.includes(b.id) ? 0 : 1;
      return aActive - bActive;
    });

    const renderChallenge = (c, expanded) => {
      const active = selectedChallengeIds.includes(c.id);
      if (!active && !expanded) return '';
      const level = challengeProgress[c.id]?.level || 0;
      const target = getChallengeTarget(c, level);
      const count = challengeProgress[c.id]?.count || 0;
      const pct = Math.min(100, Math.round(count / target * 100));
      const done = challengeProgress[c.id]?.rewarded;
      const levelBadge = level > 0 ? ` <span style="font-size:10px;background:${c.color};color:#fff;border-radius:4px;padding:1px 5px">Lvl ${level + 1}</span>` : '';
      return `
        <div class="card profile-challenge-row${active ? ' profile-challenge-active' : ''}" style="padding:0">
          <div class="mini-challenge">
            <div class="mini-challenge-top">
              <div class="challenge-icon" style="background:${c.color}20;font-size:20px">${done ? '✅' : c.icon}</div>
              <button class="mini-challenge-remove" onclick="toggleChallengeFromProfile('${c.id}')" aria-label="${active ? 'Entfernen' : 'Hinzufügen'}">${active
                ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>'
              }</button>
            </div>
            <div style="min-width:0">
              <div style="font-weight:500;font-size:14px">${c.title}${levelBadge}</div>
              <div style="font-size:12px;color:var(--muted)">${active ? `${count} / ${target} ${c.unit}` : ''}</div>
              ${active && !done ? `<div class="progress-bar" style="margin-top:6px;height:5px;background:rgba(0,0,0,0.08);border-radius:3px"><div class="progress-fill" style="width:${pct}%;background:${c.color};border-radius:3px"></div></div>` : ''}
            </div>
          </div>
        </div>`;
    };

    const isExpanded = challengesContainer.dataset.expanded === 'true';
    const activeHtml = sorted.filter(c => selectedChallengeIds.includes(c.id)).map(c => renderChallenge(c, true)).join('');
    const inactiveHtml = isExpanded ? sorted.filter(c => !selectedChallengeIds.includes(c.id)).map(c => renderChallenge(c, true)).join('') : '';
    const inactiveCount = sorted.filter(c => !selectedChallengeIds.includes(c.id)).length;
    const chevron = isExpanded
      ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14" style="display:inline-block;vertical-align:-2px" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14" style="display:inline-block;vertical-align:-2px" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>';
    const toggleBtn = inactiveCount > 0 ? `<button class="profile-challenges-expand-btn" onclick="toggleProfileChallengesExpand()">${chevron} ${isExpanded ? 'Weniger anzeigen' : `Alle Challenges (${inactiveCount})`}</button>` : '';

    challengesContainer.innerHTML = activeHtml + inactiveHtml + toggleBtn;
  }
}

function toggleChallengeFromProfile(challengeId) {
  const challenges = loadChallenges();
  const idx = challenges.indexOf(challengeId);
  if (idx > -1) challenges.splice(idx, 1);
  else challenges.push(challengeId);
  saveChallenges(challenges);
  renderProfileView();
}

function toggleProfileChallengesExpand() {
  const el = document.getElementById('profile-challenges-view');
  if (!el) return;
  el.dataset.expanded = el.dataset.expanded === 'true' ? 'false' : 'true';
  renderProfileView();
}

function toggleEditMode() {
  const viewMode = document.getElementById('profile-view');
  const editMode = document.getElementById('profile-edit');
  const editBtn = document.getElementById('edit-btn');
  const editBtnText = document.getElementById('edit-btn-text');
  
  if (!viewMode || !editMode || !editBtn) return;
  
  const isEditing = editMode.style.display === 'block';
  
  if (isEditing) {
    // Switch to view mode
    viewMode.style.display = 'block';
    editMode.style.display = 'none';
    editBtnText.textContent = 'Einstellungen';
    renderProfileView();
  } else {
    // Switch to edit mode
    viewMode.style.display = 'none';
    editMode.style.display = 'block';
    editBtnText.textContent = 'Abbrechen';
    loadEditForm();
  }
}

function loadEditForm() {
  const profile = loadProfileData();
  
  // Load avatar
  const avatar = profile.avatar || profile.name.charAt(0).toUpperCase();
  const editAvatarEl = document.getElementById('edit-avatar');
  const editAvatarInput = document.getElementById('edit-avatar-input');
  
  if (!editAvatarEl || !editAvatarInput) return;
  
  editAvatarEl.textContent = avatar;
  editAvatarInput.value = avatar;
  
  // Update avatar on input change
  editAvatarInput.addEventListener('input', (e) => {
    const val = e.target.value.slice(0, 1) || profile.name.charAt(0).toUpperCase();
    editAvatarEl.textContent = val;
    e.target.value = val;
  });
  
  // Load name
  const editNameEl = document.getElementById('edit-name');
  if (editNameEl) editNameEl.value = profile.name;
  
  // Load diet
  const dietPills = document.querySelectorAll('#edit-diet-pills .auswahl');
  dietPills.forEach(pill => {
    pill.classList.remove('aktiv');
    if (profile.diet && profile.diet.includes(pill.textContent.trim())) {
      pill.classList.add('aktiv');
    }
  });
}

function saveProfile() {
  const editAvatarInput = document.getElementById('edit-avatar-input');
  const editNameEl = document.getElementById('edit-name');
  
  const avatar = editAvatarInput?.value?.slice(0, 1) || 'B';
  const name = editNameEl?.value?.trim() || 'Benutzer';
  const dietPills = document.querySelectorAll('#edit-diet-pills .auswahl.aktiv');
  const diet = Array.from(dietPills).map(p => p.textContent.trim());

  const oldProfile = JSON.parse(localStorage.getItem('gruenkorb-profile') || '{}');
  const finalDiet = diet.length > 0 ? diet : ['Alles'];

  const profileData = {
    avatar,
    name,
    diet: finalDiet,
    region: 'Deutschland',
    onboardingDate: oldProfile.onboardingDate || new Date().toISOString()
  };

  localStorage.setItem('gruenkorb-profile', JSON.stringify(profileData));

  // Adjust diet bonus points when diet changes
  const newBonus = _dietStartingPoints(finalDiet);
  const oldBonus = _dietStartingPoints(oldProfile.diet || []);
  if (newBonus !== oldBonus) {
    const score = JSON.parse(localStorage.getItem('gruenkorb-score') || '{"total":0,"swaps":0,"purchases":0,"dietBonus":0}');
    score.total = Math.max(0, score.total - (score.dietBonus || 0) + newBonus);
    score.dietBonus = newBonus;
    localStorage.setItem('gruenkorb-score', JSON.stringify(score));
  }

  toggleEditMode();
}

// ===== Challenge Functions =====

const availableChallenges = [
  {
    id: 'purchases-10',
    title: '10 Einkäufe abschließen',
    description: 'Schließe 10 Einkäufe in der App ab',
    icon: '🛍️',
    color: '#6a1b9a',
    target: 10,
    unit: 'Einkäufe',
    reward: 50
  },
  {
    id: 'regional-seasonal',
    title: 'Eine Woche saisonal',
    description: 'Kaufe 7 saisonale Produkte (grüne Ampel)',
    icon: '🌱',
    color: '#2d7a4f',
    target: 7,
    unit: 'saisonale Artikel',
    reward: 30
  },
  {
    id: 'veggie-week',
    title: 'Veggie-Woche',
    description: '4 Einkäufe komplett ohne Fleisch abschließen',
    icon: '🥗',
    color: '#689f38',
    target: 4,
    unit: 'fleischfreie Einkäufe',
    reward: 25
  },
  {
    id: 'eco-swaps',
    title: '5 bewusste Alternativen',
    description: 'Wähle 5× eine pflanzliche Alternative statt Tier',
    icon: '♻️',
    color: '#0277bd',
    target: 5,
    unit: 'Alternativen gewählt',
    reward: 20
  },
  {
    id: 'recipes-5',
    title: '5 Rezepte importieren',
    description: 'Importiere 5 Rezepte per Link in die Einkaufsliste',
    icon: '👨‍🍳',
    color: '#d84315',
    target: 5,
    unit: 'Rezepte importiert',
    reward: 15
  },
  {
    id: 'scan-10',
    title: 'Scanner-Profi',
    description: 'Scanne 10 verschiedene Produkte im Laden',
    icon: '📷',
    color: '#00897b',
    target: 10,
    unit: 'Produkte gescannt',
    reward: 15
  },
  {
    id: 'cook-3',
    title: '3 Saisonrezepte kochen',
    description: 'Koche 3 Rezepte aus dem Kochbuch',
    icon: '🍳',
    color: '#ef6c00',
    target: 3,
    unit: 'Rezepte gekocht',
    reward: 20
  },
  {
    id: 'myths-3',
    title: '3 Mythos vs. Fakten lesen',
    description: 'Lies 3 Karten aus "Mythos vs. Fakten"',
    icon: '📖',
    color: '#5d4037',
    target: 3,
    unit: 'Mythen gelesen',
    reward: 5
  }
];

function loadChallengeProgress() {
  return JSON.parse(localStorage.getItem('gruenkorb-challenge-progress') || '{}');
}

function saveChallengeProgress(p) {
  localStorage.setItem('gruenkorb-challenge-progress', JSON.stringify(p));
}

function updateChallengeProgress(id, increment) {
  const active = loadChallenges();
  if (!active.includes(id)) return;
  const p = loadChallengeProgress();
  if (!p[id]) p[id] = { count: 0, rewarded: false, level: 0 };
  const challenge = availableChallenges.find(c => c.id === id);
  if (!challenge) return;
  if (p[id].rewarded) return;
  const target = getChallengeTarget(challenge, p[id].level || 0);
  p[id].count = Math.min((p[id].count || 0) + increment, target);
  saveChallengeProgress(p);

  if (p[id].count >= target && !p[id].rewarded) {
    p[id].rewarded = true;
    p[id].weekCompleted = getWeekNumber();
    saveChallengeProgress(p);
    const reward = challenge.reward || 10;
    const score = JSON.parse(localStorage.getItem('gruenkorb-score') || '{"total":0,"swaps":0,"purchases":0,"challengesCompleted":0}');
    score.total += reward;
    score.challengesCompleted = (score.challengesCompleted || 0) + 1;
    localStorage.setItem('gruenkorb-score', JSON.stringify(score));
    setTimeout(() => _showToast(`🏆 +${reward} Punkte! Challenge abgeschlossen: ${challenge.title}`), 400);
    if (typeof gmAfterScoreChange === 'function') setTimeout(gmAfterScoreChange, 450);
  }
}

const weeklyMyths = [
  {
    icon: '🥑',
    title: 'Mythos: Avocados sind umweltschädlich',
    text: 'Avocados haben einen hohen Wasserverbrauch, aber ihr CO₂-Fußabdruck ist moderat – vergleichbar mit anderen Früchten. Problematisch sind nur Avocados aus Regionen mit starkem Wasserstress.',
    fact: 'Tipp: Herkunft beachten. Chile & Peru = oft wasserarm. Spanien, Mexiko, Kenia = meist weniger problematisch.',
    source: 'FAO-Wasserstressdaten, LCA-Analysen'
  },
  {
    icon: '🌴',
    title: 'Mythos: Palmöl ist das schlimmste Öl',
    text: 'Palmöl ist das effizienteste Pflanzenöl der Welt und braucht viel weniger Fläche als Raps oder Sonnenblume. Das Problem ist Entwaldung durch schlechte Anbaumethoden – nicht das Öl selbst.',
    fact: 'Boykott ist kontraproduktiv: Er führt zu schlechteren Alternativen. Besser: Produkte mit zertifiziertem, entwaldungsfreiem Palmöl wählen.',
    source: 'FAO-Landnutzungsdaten'
  },
  {
    icon: '🗺️',
    title: 'Mythos: Regional ist immer nachhaltiger',
    text: 'Saison und Produktionsmethode sind wichtiger als die Entfernung. Importierte Freiland-Tomaten aus Spanien im Winter sind oft klimafreundlicher als regionale Tomaten aus dem beheizten Gewächshaus.',
    fact: 'Transport macht weniger als 10 % der Lebensmittel-Emissionen aus. Die Produktionsweise entscheidet.',
    source: 'Poore & Nemecek (2018), Science'
  },
  {
    icon: '🛍️',
    title: 'Mythos: Plastikverpackung ist das größte Problem',
    text: 'Verpackung macht nur einen kleinen Teil der Lebensmittel-Emissionen aus. Lebensmittelverschwendung ist viel schlimmer – und Plastik verhindert oft genau das.',
    fact: 'Wenn Lebensmittelverschwendung ein Land wäre, wäre sie der drittgrößte CO₂-Emittent der Welt – nach USA und China.',
    source: 'FAO Food Waste Study'
  },
  {
    icon: '🫘',
    title: 'Mythos: Soja zerstört den Regenwald',
    text: '80 % des weltweit angebauten Sojas wird als Tierfutter verwendet – nicht für Tofu oder Sojamilch. Pflanzliche Sojaprodukte sind nicht der Treiber der Entwaldung.',
    fact: 'Tofu hat nur ca. 2,9 kg CO₂/kg. Das Tierfutter-Soja für 1 kg Rindfleisch verursacht dagegen Dutzende Kilogramm CO₂.',
    source: 'FAO Soja-Daten'
  },
  {
    icon: '✈️',
    title: 'Mythos: Flugware ist selten, also egal',
    text: 'Luftfracht ist extrem klimaschädlich – bis zu 50× mehr Emissionen als Seefracht. Besonders betroffen: frische Beeren, Spargel, grüne Bohnen und frischer Fisch außerhalb der Saison.',
    fact: 'Erkennungszeichen: kein Herkunftsland auf der Verpackung, oder Hinweis "per Luftfracht". Im Zweifel nachfragen.',
    source: 'LCA Flugtransport-Daten'
  },
  {
    icon: '🌿',
    title: 'Mythos: Bio ist immer besser',
    text: 'Bio kann besser sein – aber nicht immer. Manchmal sind die Erträge niedriger, was mehr Land für dieselbe Menge Nahrung braucht. Entscheidend sind Ertrag, Dünger und Anbaukontext.',
    fact: 'Bio-Rindfleisch verursacht oft mehr CO₂ als konventionelles – weil die Tiere länger leben und mehr Fläche brauchen.',
    source: 'LCA Bio vs. konventionell, diverse Studien'
  },
  {
    icon: '🥩',
    title: 'Was wirklich zählt: Weniger Fleisch',
    text: 'Fleisch macht nur 18 % unserer Kalorien aus, aber über 60 % der Lebensmittel-Emissionen. Kein anderer Schritt hat so viel Wirkung wie die Reduktion von Rindfleisch.',
    fact: 'Weniger Rindfleisch zu essen wirkt stärker auf dein CO₂-Budget als auf ein Elektroauto umzusteigen.',
    source: 'Poore & Nemecek (2018)'
  },
  {
    icon: '💧',
    title: 'Virtuelles Wasser: Was steckt in deinem Essen?',
    text: 'Für 1 kg Rindfleisch werden bis zu 15.000 Liter Wasser verbraucht – für 1 kg Tofu nur 2.500 Liter. Das Wasser steckt unsichtbar in Futtermitteln, Produktion und Verarbeitung.',
    fact: 'Kuhmilch verbraucht 628 Liter Wasser pro Liter – Sojamilch nur 28 Liter, Hafermilch nur 48 Liter.',
    source: 'Hoekstra & Mekonnen (2012), Water Footprint Network'
  },
  {
    icon: '🌾',
    title: 'Welche Pflanzenmilch ist wirklich die beste?',
    text: 'Hafermilch ist die ausgewogenste Wahl: niedrig in CO₂, sehr niedrig im Wasserverbrauch und wenig Landnutzung. Mandelmilch hat zwar weniger CO₂ – braucht aber 8× mehr Wasser.',
    fact: 'Kuhmilch verursacht 3,2 kg CO₂/L und 628 L Wasser/L – Hafermilch nur 0,9 kg CO₂ und 48 L Wasser.',
    source: 'Poore & Nemecek (2018), Oxford University'
  },
  {
    icon: '🍎',
    title: 'Lagerobst schlägt Frischimport',
    text: 'Äpfel aus deutschem Lager sind bis Mai klimafreundlicher als frische Erdbeeren aus Spanien oder Marokko im Winter. Kühllagerung verbraucht wenig Energie im Vergleich zu Luftfracht.',
    fact: 'Lagerobst aus regionaler Ernte hat oft einen 10× kleineren CO₂-Fußabdruck als Flugware gleicher Art.',
    source: 'LCA-Daten Saisonalität Deutschland'
  },
  {
    icon: '🧀',
    title: 'Käse: der unterschätzte Klimatreiber',
    text: 'Käse verursacht bis zu 21 kg CO₂/kg – ähnlich viel wie Lamm. Für 1 kg Käse braucht es ca. 10 Liter Milch. Der scheinbar kleine Snack hat einen großen Fußabdruck.',
    fact: 'Hefeflocken sind eine überraschend gute Alternative: ähnlicher Umami-Geschmack, ein Bruchteil der Emissionen.',
    source: 'FAO / Poore & Nemecek (2018)'
  },
];

let _mythCardIdx = 0;
let _mythSwipeX = null;

function openMythCards() {
  const _now = new Date();
  const _dayOfYear = Math.floor((_now - new Date(_now.getFullYear(), 0, 1)) / 86400000);
  _mythCardIdx = (Math.ceil((_dayOfYear + 1) / 7) - 1) % weeklyMyths.length;
  const overlay = document.createElement('div');
  overlay.id = 'myth-overlay';
  overlay.className = 'myth-overlay';
  overlay.innerHTML = `
    <div class="myth-cards-sheet">
      <div class="myth-cards-header">
        <span class="myth-cards-label">✦ Mythos vs. Fakten</span>
        <button onclick="closeMythCards()" class="myth-close-btn" aria-label="Schließen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="myth-cards-track" id="myth-cards-track"></div>
      <div class="myth-cards-dots" id="myth-cards-dots"></div>
      <div class="myth-cards-nav">
        <button class="myth-nav-btn" id="myth-prev" onclick="mythNav(-1)" aria-label="Zurück">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
        <span class="myth-counter" id="myth-counter"></span>
        <button class="myth-nav-btn" id="myth-next" onclick="mythNav(1)" aria-label="Weiter">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeMythCards(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  _renderMythCard();
  // Aktuell angezeigten Mythos als gelesen markieren
  const readKey = 'gruenkorb-myths-read';
  const read = JSON.parse(localStorage.getItem(readKey) || '[]');
  if (!read.includes(_mythCardIdx)) {
    read.push(_mythCardIdx);
    localStorage.setItem(readKey, JSON.stringify(read));
    updateChallengeProgress('myths-3', 1);
  }

  // Swipe support
  const track = overlay.querySelector('.myth-cards-sheet');
  track.addEventListener('touchstart', e => { _mythSwipeX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (_mythSwipeX === null) return;
    const dx = e.changedTouches[0].clientX - _mythSwipeX;
    _mythSwipeX = null;
    if (Math.abs(dx) > 40) mythNav(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function closeMythCards() {
  const o = document.getElementById('myth-overlay');
  if (!o) return;
  o.classList.remove('open');
  o.addEventListener('transitionend', () => o.remove(), { once: true });
}

function mythNav(dir) {
  const newIdx = _mythCardIdx + dir;
  if (newIdx < 0 || newIdx >= weeklyMyths.length) return;
  _mythCardIdx = newIdx;
  _renderMythCard();
  // Track reading for challenge (count each unique myth seen)
  const readKey = 'gruenkorb-myths-read';
  const read = JSON.parse(localStorage.getItem(readKey) || '[]');
  if (!read.includes(_mythCardIdx)) {
    read.push(_mythCardIdx);
    localStorage.setItem(readKey, JSON.stringify(read));
    updateChallengeProgress('myths-3', 1);
  }
}

function _renderMythCard() {
  const track = document.getElementById('myth-cards-track');
  const dots  = document.getElementById('myth-cards-dots');
  const counter = document.getElementById('myth-counter');
  const prevBtn = document.getElementById('myth-prev');
  const nextBtn = document.getElementById('myth-next');
  if (!track) return;

  const m = weeklyMyths[_mythCardIdx];
  track.innerHTML = `
    <div class="myth-card">
      <div class="myth-card-icon">${m.icon || '💡'}</div>
      <h3 class="myth-card-title">${m.title}</h3>
      <p class="myth-card-text">${m.text}</p>
      ${m.fact ? `<div class="myth-card-fact">💡 ${m.fact}</div>` : ''}
      ${m.source ? `<div class="myth-card-source">Quelle: ${m.source}</div>` : ''}
    </div>`;

  dots.innerHTML = weeklyMyths.map((_, i) =>
    `<span class="myth-dot${i === _mythCardIdx ? ' active' : ''}"></span>`
  ).join('');

  counter.textContent = `${_mythCardIdx + 1} / ${weeklyMyths.length}`;
  if (prevBtn) prevBtn.style.opacity = _mythCardIdx === 0 ? '0.3' : '1';
  if (nextBtn) nextBtn.style.opacity = _mythCardIdx === weeklyMyths.length - 1 ? '0.3' : '1';
}

function getWeeklyMyth() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const weekNumber = Math.ceil((dayOfYear + 1) / 7);
  const mythIndex = (weekNumber - 1) % weeklyMyths.length;
  return weeklyMyths[mythIndex];
}

function getWeekNumber() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
  return Math.ceil((dayOfYear + 1) / 7);
}

function checkWeeklyReset() {
  const currentWeek = getWeekNumber();
  const p = loadChallengeProgress();
  let changed = false;
  for (const [id, data] of Object.entries(p)) {
    if (data.rewarded && data.weekCompleted && currentWeek > data.weekCompleted) {
      p[id] = { count: 0, rewarded: false, level: (data.level || 0) + 1, weekCompleted: null };
      changed = true;
    }
  }
  if (changed) saveChallengeProgress(p);
}

function getChallengeTarget(c, level) {
  return Math.round(c.target * (1 + (level || 0) * 0.5));
}

function loadChallenges() {
  const saved = localStorage.getItem('gruenkorb-challenges') || '[]';
  return JSON.parse(saved);
}

function saveChallenges(challenges) {
  localStorage.setItem('gruenkorb-challenges', JSON.stringify(challenges));
}

function openChallengeSelector() {
  const modal = document.getElementById('challenge-modal');
  if (!modal) return;
  
  const selectedChallenges = loadChallenges();
  const optionsContainer = document.getElementById('challenge-options');
  
  optionsContainer.innerHTML = availableChallenges.map(challenge => {
    const isSelected = selectedChallenges.includes(challenge.id);
    return `
      <div class="challenge-option ${isSelected ? 'selected' : ''}" onclick="toggleChallenge('${challenge.id}')">
        <div style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor:pointer;width:18px;height:18px">
          <div style="flex:1">
            <div class="challenge-option-title">${challenge.icon} ${challenge.title}</div>
            <div class="challenge-option-desc">${challenge.description}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  modal.style.display = 'flex';
}

function closeChallengeSelector() {
  const modal = document.getElementById('challenge-modal');
  if (modal) modal.style.display = 'none';
  renderSelectedChallenges();
}

function toggleChallenge(challengeId) {
  const challenges = loadChallenges();
  const index = challenges.indexOf(challengeId);
  
  if (index > -1) {
    challenges.splice(index, 1);
  } else {
    challenges.push(challengeId);
  }
  
  saveChallenges(challenges);
  openChallengeSelector();
}

function renderSelectedChallenges() {
  const selectedChallenges = loadChallenges();
  const container = document.getElementById('selected-challenges');
  const noMsg = document.getElementById('no-challenges-msg');
  const headerBtn = document.getElementById('add-challenge-btn-header');

  if (!container) return;

  if (selectedChallenges.length === 0) {
    container.innerHTML = '';
    if (noMsg) noMsg.style.display = 'block';
    if (headerBtn) headerBtn.style.display = 'none';
    return;
  }

  if (noMsg) noMsg.style.display = 'none';
  if (headerBtn) headerBtn.style.display = 'flex';
  
  const progress = loadChallengeProgress();
  container.innerHTML = selectedChallenges.map(challengeId => {
    const challenge = availableChallenges.find(c => c.id === challengeId);
    if (!challenge) return '';
    const count = progress[challengeId]?.count || 0;
    // Ziel steigt mit jedem Level (wie im Profil) – vorher stand hier immer das Grundziel
    const target = getChallengeTarget(challenge, progress[challengeId]?.level || 0);
    const pct = Math.min(100, Math.round(count / target * 100));
    const done = count >= target;
    return `
      <div class="card" style="padding:0">
        <div class="mini-challenge">
          <div class="mini-challenge-top">
            <div class="challenge-icon" style="background:${challenge.color}20;font-size:20px">
              ${done ? '✅' : challenge.icon}
            </div>
            <button class="mini-challenge-remove" onclick="removeChallenge('${challengeId}')" aria-label="Entfernen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div>
            <div style="font-weight:500;font-size:14px">${challenge.title}</div>
            <div style="font-size:12px;color:var(--muted)">${count} / ${target} ${challenge.unit}</div>
            <div class="progress-bar" style="margin-top:6px;height:5px;background:rgba(0,0,0,0.08);border-radius:3px">
              <div class="progress-fill" style="width:${pct}%;background:${done ? '#27ae60' : challenge.color};border-radius:3px;transition:width 0.4s ease"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function removeChallenge(challengeId) {
  const challenges = loadChallenges();
  const index = challenges.indexOf(challengeId);
  if (index > -1) {
    challenges.splice(index, 1);
    saveChallenges(challenges);
    renderSelectedChallenges();
  }
}

// ===== Scanner Functions =====

const OFF_FIELDS = 'product_name,product_name_de,brands,quantity,ecoscore_grade,nutriscore_grade,origins,origins_tags,manufacturing_places,categories_tags';

let _saisondaten = null;
let _ernaehrung  = null;
let _warenkorb   = null;

async function loadSaisondaten() {
  try {
    const [sd, plu, ern, wk] = await Promise.all([
      fetch('saisondaten3.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('plu-codes.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('ernaehrung.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('warenkorb.json', { cache: 'no-store' }).then(r => r.json()),
    ]);
    _saisondaten = sd;
    _pluDaten    = plu;
    _ernaehrung  = ern;
    _warenkorb   = wk;
  } catch (e) {
    console.warn('Datendateien konnten nicht geladen werden:', e);
  }
}
loadSaisondaten();

// English OFF country slug → German name used in saisondaten.json
const LAENDER_MAP = {
  'germany': 'Deutschland', 'france': 'Frankreich', 'spain': 'Spanien',
  'netherlands': 'Niederlande', 'netherlands-the': 'Niederlande',
  'south-africa': 'Suedafrika', 'new-zealand': 'Neuseeland',
  'peru': 'Peru', 'brazil': 'Brasilien', 'india': 'Indien',
  'italy': 'Italien', 'turkey': 'Türkei', 'austria': 'Österreich',
  'poland': 'Polen', 'belgium': 'Belgien', 'portugal': 'Portugal',
  'morocco': 'Marokko', 'israel': 'Israel', 'kenya': 'Kenia',
  'chile': 'Chile', 'argentina': 'Argentinien', 'egypt': 'Ägypten',
  'china': 'China', 'colombia': 'Kolumbien', 'mexico': 'Mexiko',
  'greece': 'Griechenland', 'sweden': 'Schweden', 'denmark': 'Dänemark',
};

function _parseOriginCountries(tags) {
  if (!tags || !tags.length) return [];
  return [...new Set(tags.map(t => {
    const key = t.replace(/^[a-z]{2}:/, '').toLowerCase();
    return LAENDER_MAP[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }))];
}

function _matchSaisondaten(name, categories) {
  if (!_saisondaten) return null;
  // Nutzt denselben alias-/singular-bewussten Matcher wie der Rest der App (Liste, Rezepte),
  // damit z. B. "Karotten" genauso als "Möhre" erkannt wird wie überall sonst.
  const byFullName = _matchSaisondatenByName(name);
  if (byFullName) return byFullName;
  // Echte Barcode-Produktnamen enthalten oft Zusätze wie "Bio", Marke oder Packungsgröße
  // ("Bio Karotten", "REWE Frische Tomaten") — deshalb zusätzlich jedes Wort einzeln prüfen.
  const words = (name || '').split(/[\s,.\-()]+/).filter(w => w.length >= 3);
  for (const word of words) {
    const byWord = _matchSaisondatenByName(word);
    if (byWord) return byWord;
  }
  const catStr = (categories || []).join(' ').toLowerCase();
  return _saisondaten.produkte.find(p =>
    catStr.includes(p.id) || catStr.includes(p.name.toLowerCase())
  ) || null;
}

// Strips umlauts for fuzzy comparison (ä→a, ö→o, ü→u)
function _deUmlaut(s) {
  return s.replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss');
}

// Returns candidate singular forms by stripping common German plural suffixes
function _deSingulars(q) {
  const forms = new Set([q]);
  if (q.endsWith('n'))  forms.add(q.slice(0,-1));   // Tomaten→Tomate, Zwiebeln→Zwiebel
  if (q.endsWith('en')) forms.add(q.slice(0,-2));    // Kartoffeln→Kartoffel (via -n already covers)
  if (q.endsWith('s'))  forms.add(q.slice(0,-1));   // Champignons→Champignon
  return [...forms];
}

function _matchSaisondatenByName(query) {
  if (!_saisondaten || !query) return null;
  const q = query.toLowerCase().trim();
  if (q.length < 2) return null;

  // 1. Alias lookup (highest priority, handles irregular forms)
  if (PRODUKT_ALIASE[q]) {
    return _saisondaten.produkte.find(p => p.id === PRODUKT_ALIASE[q]) || null;
  }

  // 2. Exact ID or exact name match
  const exact = _saisondaten.produkte.find(p =>
    p.id === q || p.name.toLowerCase() === q
  );
  if (exact) return exact;

  // 3. Umlaut-normalized exact match  (Äpfel→Apfel, Kürbis→kuerbis via name)
  const qU = _deUmlaut(q);
  const uMatch = _saisondaten.produkte.find(p =>
    _deUmlaut(p.name.toLowerCase()) === qU
  );
  if (uMatch) return uMatch;

  // 4. Plural → singular: try stripped forms, check alias + exact + umlaut
  for (const form of _deSingulars(q)) {
    if (form === q) continue;
    if (PRODUKT_ALIASE[form]) {
      return _saisondaten.produkte.find(p => p.id === PRODUKT_ALIASE[form]) || null;
    }
    const fU = _deUmlaut(form);
    const sMatch = _saisondaten.produkte.find(p =>
      p.id === form || p.name.toLowerCase() === form ||
      _deUmlaut(p.name.toLowerCase()) === fU
    );
    if (sMatch) return sMatch;
  }

  // 5. Compound word: query begins or ends with a product name/id (≥5 chars)
  //    e.g. "Knoblauchzehen" starts with "Knoblauch"
  //    e.g. "Cherrytomaten" ends with (singular of) "Tomaten" → "Tomate"
  const allForms = _deSingulars(qU);
  for (const form of allForms) {
    const comp = _saisondaten.produkte.find(p => {
      const pU = _deUmlaut(p.name.toLowerCase().replace(/\s*\(.*?\)/g,'').trim());
      if (pU.length < 5) return false;
      return form.startsWith(pU) || form.endsWith(pU);
    });
    if (comp) return comp;
  }

  return null;
}

// Match against ernaehrung.json (dairy, meat, eggs, fish)
function _getErnProduktById(id) {
  if (!_ernaehrung || !id) return null;
  for (const kategorie of Object.values(_ernaehrung)) {
    for (const produkt of kategorie) {
      if (produkt.id === id) return produkt;
    }
  }
  return null;
}

function _matchErnaehrung(query) {
  if (!_ernaehrung || !query) return null;
  const q = query.toLowerCase().trim();
  if (q.length < 2) return null;
  const qU = _deUmlaut(q);
  for (const kategorie of Object.values(_ernaehrung)) {
    for (const produkt of kategorie) {
      for (const alias of (produkt.aliases || [])) {
        const aU = _deUmlaut(alias.toLowerCase());
        if (aU === qU || alias.toLowerCase() === q) return { ...produkt, _kategorie: Object.keys(_ernaehrung).find(k => _ernaehrung[k].includes(produkt)) };
      }
      // Also try plural stripping
      for (const form of _deSingulars(q)) {
        const fU = _deUmlaut(form);
        for (const alias of (produkt.aliases || [])) {
          if (_deUmlaut(alias.toLowerCase()) === fU) return { ...produkt, _kategorie: Object.keys(_ernaehrung).find(k => _ernaehrung[k].includes(produkt)) };
        }
      }
    }
  }
  return null;
}

// Simple Levenshtein distance for fuzzy matching
function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Returns up to 3 closest product name suggestions (saisondaten + ernaehrung)
function _fuzzyMatch(query) {
  if (!query || query.length < 2) return [];
  const q = _deUmlaut(query.toLowerCase().trim());
  const maxDist = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  const candidates = [];

  if (_saisondaten) {
    for (const p of _saisondaten.produkte) {
      const pU = _deUmlaut(p.name.toLowerCase());
      const dist = _levenshtein(q, pU);
      if (dist > 0 && dist <= maxDist) candidates.push({ name: p.name, emoji: null, dist });
      // Also check ID
      const idDist = _levenshtein(q, _deUmlaut(p.id));
      if (idDist > 0 && idDist <= maxDist && idDist < dist) {
        candidates[candidates.length-1] && candidates[candidates.length-1].name === p.name
          ? (candidates[candidates.length-1].dist = idDist)
          : candidates.push({ name: p.name, emoji: null, dist: idDist, id: p.id });
      }
    }
  }
  if (_ernaehrung) {
    for (const kategorie of Object.values(_ernaehrung)) {
      for (const p of kategorie) {
        const pU = _deUmlaut(p.name.toLowerCase());
        const dist = _levenshtein(q, pU);
        if (dist > 0 && dist <= maxDist) candidates.push({ name: p.name, emoji: p.emoji, dist });
      }
    }
  }

  // Deduplicate by name, sort by distance
  const seen = new Set();
  return candidates
    .sort((a, b) => a.dist - b.dist)
    .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
    .slice(0, 3);
}

function _globalMonthGrid(produkt, currentMonth) {
  const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const regeln = _saisondaten?.bewertungsregeln || {};
  const scorePriority = ['regional_ernte','regional_lager','kultur_ganzjaehrig','import_ernte_lkw','regional_gewaechshaus','import_gewaechshaus','import_schiff','import_flug'];

  const cells = MN.map((name, i) => {
    const m = i + 1;
    const candidates = [];
    for (const l of produkt.laender) {
      const phase = _getPhaseForMonth(l, m);
      if (!phase) continue;
      const key = _regelKeyForEntry(l, phase);
      if (key && regeln[key]) {
        const ampel = _wasserstressAmpel(regeln[key].ampel, key, l.land);
        candidates.push({ regelKey: key, ampel, land: l.land });
      }
    }
    candidates.sort((a, b) => scorePriority.indexOf(a.regelKey) - scorePriority.indexOf(b.regelKey));
    const best = candidates[0];

    let cls = 'month-cell';
    if (best) {
      if (best.regelKey === 'regional_ernte')       cls += ' month-ernte';
      else if (best.regelKey === 'regional_lager')  cls += ' month-lager';
      else if (best.ampel === 'rot')                cls += ' month-rot';
      else                                          cls += ' month-gh';
    }
    if (m === currentMonth) cls += ' month-current';
    return `<span class="${cls}" title="${best ? best.regelKey.replace(/_/g,' ') : 'nicht verfügbar'}">${name}</span>`;
  });

  return `<div class="month-grid">${cells.join('')}</div>
  <div class="month-legend">
    <span class="mleg mleg-ernte">Regionale Ernte</span>
    <span class="mleg mleg-lager">Lagerware</span>
    <span class="mleg mleg-gh">Import / Gewächshaus</span>
    <span class="mleg mleg-out">Nicht verfügbar</span>
  </div>`;
}

function _buildLaenderCards(produkt, monat, MN) {
  const regeln = _saisondaten?.bewertungsregeln || {};
  const inSaison = [], nichtSaison = [];

  for (const l of produkt.laender) {
    const phase = _getPhaseForMonth(l, monat);
    const regelKey = phase ? _regelKeyForEntry(l, phase) : null;
    const regel = regelKey ? regeln[regelKey] : null;
    const baseAmpel = regel?.ampel || null;
    const ampel = baseAmpel ? _wasserstressAmpel(baseAmpel, regelKey, l.land) : null;
    const phaseLabel = { ernte: 'Freiland-Ernte', lager: 'Lagerware', gewaechshaus: 'Gewächshaus', zuchtpilz: 'Ganzjährig' }[phase?.typ] || null;
    const randsaison = phase?.konfidenz === 'niedrig';
    const endMonth = phase ? _phaseEndMonth(phase, monat) : null;
    const ws = regelKey?.startsWith('import_') ? _getWasserstress(l.land) : null;
    if (ampel === 'gruen' || ampel === 'gelb') {
      inSaison.push({ land: l.land, ampel, phaseLabel, randsaison, endMonth, ws });
    } else {
      nichtSaison.push({ land: l.land });
    }
  }

  // DE first, then grün, then gelb
  inSaison.sort((a, b) => {
    const rank = e => e.land === 'Deutschland' ? 0 : e.ampel === 'gruen' ? 1 : 2;
    return rank(a) - rank(b);
  });

  const DOT = { gruen: '🟢', gelb: '🟡' };

  const inRows = inSaison.map(({ land, ampel, phaseLabel, randsaison, endMonth, ws }) => {
    const wsBadge = ws && ws.kategorie >= 4
      ? ` <span class="ws-tag ws-kat-${ws.kategorie}">💧 ${ws.kategorie >= 5 ? 'Extrem' : 'Hoch'}</span>`
      : '';
    return `<div class="detail-land-row detail-land-${ampel}">
      <span class="detail-land-dot">${DOT[ampel]}</span>
      <span class="detail-land-name">${_displayLandName(land)}${randsaison ? ' <span class="randsaison-tag">Randsaison</span>' : ''}${wsBadge}</span>
      <span class="detail-land-phase">${phaseLabel}${endMonth ? `<span class="detail-land-until">bis ${MN[endMonth-1]}.</span>` : ''}</span>
    </div>`;
  }).join('');

  const outRows = nichtSaison.map(({ land }) =>
    `<div class="detail-land-row detail-land-out">
      <span class="detail-land-dot">🔴</span>
      <span class="detail-land-name" style="color:var(--muted)">${_displayLandName(land)}</span>
      <span class="detail-land-phase" style="color:var(--muted)">Nicht in Saison</span>
    </div>`).join('');

  const inCard = inSaison.length
    ? `<div class="card detail-insaison-card">
        <div class="detail-card-label">Jetzt in Saison – ${MN[monat-1]}</div>
        ${inRows}
      </div>`
    : `<div class="card">
        <div class="detail-card-label" style="color:var(--muted)">${MN[monat-1]}</div>
        <div style="font-size:var(--t-md);color:var(--muted)">🔴 Aktuell nirgendwo in Saison</div>
      </div>`;

  const outCard = nichtSaison.length
    ? `<div class="card">
        <div class="detail-card-label" style="color:var(--muted)">Nicht in Saison im ${MN[monat-1]}</div>
        ${outRows}
      </div>`
    : '';

  return { inCard, outCard };
}

function _phaseEndMonth(phase, currentMonth) {
  const monthSet = new Set(phase.monate);
  if (!monthSet.has(currentMonth)) return null;
  let end = currentMonth;
  for (let i = 0; i < 12; i++) {
    const next = (end % 12) + 1;
    if (monthSet.has(next)) { end = next; if (end === currentMonth) return null; }
    else break;
  }
  return end;
}

function _getPhaseForMonth(eintrag, monat) {
  const phasePriority = ['ernte', 'lager', 'gewaechshaus', 'zuchtpilz'];
  for (const typ of phasePriority) {
    const kandidaten = (eintrag.phasen || []).filter(p => p.typ === typ && p.monate.includes(monat));
    if (!kandidaten.length) continue;
    return kandidaten.find(p => (p.konfidenz || 'hoch') === 'hoch') || kandidaten[0];
  }
  return null;
}

function _findeAlternativen(produktId, maxAnzahl = 4) {
  if (!_saisondaten) return [];
  const monat = new Date().getMonth() + 1;
  const quelle = _saisondaten.produkte.find(p => p.id === produktId);
  if (!quelle) return [];
  const regeln = _saisondaten.bewertungsregeln;
  const ergebnis = [];

  for (const p of _saisondaten.produkte) {
    if (p.id === produktId || p.kategorie !== quelle.kategorie) continue;
    for (const l of p.laender) {
      const phase = _getPhaseForMonth(l, monat);
      if (!phase) continue;
      const key = _regelKeyForEntry(l, phase);
      if (key && regeln[key]?.ampel === 'gruen') {
        ergebnis.push({ id: p.id, name: p.name, kategorie: p.kategorie });
        break;
      }
    }
    if (ergebnis.length >= maxAnzahl) break;
  }
  return ergebnis;
}

function _getWasserstress(land) {
  return _saisondaten?.wasserstress?.[land] || null;
}

function _wasserstressAmpel(ampel, regelKey, land) {
  if (!regelKey?.startsWith('import_')) return ampel;
  const ws = _getWasserstress(land);
  if (!ws || ws.kategorie < 4) return ampel;
  if (ampel === 'gruen') return 'gelb';
  if (ampel === 'gelb')  return 'rot';
  return ampel;
}

function _displayLandName(land) {
  return land.replace(/_/g, ' / ');
}

function _regelKeyForEntry(eintrag, phase) {
  const t = eintrag.transportart;
  const p = phase.typ;
  if (t === 'regional') {
    if (p === 'ernte')         return 'regional_ernte';
    if (p === 'lager')         return 'regional_lager';
    if (p === 'gewaechshaus')  return 'regional_gewaechshaus';
    if (p === 'zuchtpilz')     return 'kultur_ganzjaehrig';
  }
  if (t === 'lkw') return p === 'gewaechshaus' ? 'import_gewaechshaus' : 'import_ernte_lkw';
  if (t === 'schiff') return 'import_schiff';
  if (t === 'flug')   return 'import_flug';
  return null;
}

function _calculateSaisonScore(saisonProdukt, originCountries) {
  if (!_saisondaten) return null;
  const monat  = new Date().getMonth() + 1;
  const regeln = _saisondaten.bewertungsregeln;

  // Build candidates: all country entries that have an active phase this month
  const candidates = [];
  for (const l of saisonProdukt.laender) {
    const phase = _getPhaseForMonth(l, monat);
    if (!phase) continue;
    const regelKey = _regelKeyForEntry(l, phase);
    if (regelKey && regeln[regelKey]) {
      const baseAmpel = regeln[regelKey].ampel;
      const ampel = _wasserstressAmpel(baseAmpel, regelKey, l.land);
      candidates.push({ land: l.land, regelKey, ampel, text: regeln[regelKey].text });
    }
  }
  if (!candidates.length) return null;

  // If we know the origin country from a scan, prefer that entry
  for (const country of originCountries) {
    const match = candidates.find(c => c.land.toLowerCase() === country.toLowerCase());
    if (match) return match;
  }

  // Otherwise pick the most sustainable available option
  const scorePriority = [
    'regional_ernte', 'regional_lager', 'kultur_ganzjaehrig',
    'import_ernte_lkw', 'regional_gewaechshaus',
    'import_gewaechshaus', 'import_schiff', 'import_flug',
  ];
  candidates.sort((a, b) => scorePriority.indexOf(a.regelKey) - scorePriority.indexOf(b.regelKey));
  return candidates[0];
}

let _scanControls = null;
let _scanActive   = false;
let _scanRequestId = 0;
let _scanResumeAt  = 0;

// Ordnet einen Öko-Score-Buchstaben derselben Ampel-Skala (gruen/gelb/rot) zu wie die
// Saisonalität — damit nicht-saisonale Produkte (z. B. Getränke) dieselbe Banner-/
// Nachrichtenfarblogik bekommen wie Obst & Gemüse, statt eine Sonderbehandlung zu haben.
function _ampelFromGrade(grade) {
  const g = (grade || '').toUpperCase();
  if (g === 'A-PLUS' || g === 'A' || g === 'B') return { ampel: 'gruen', label: '🟢 Gute Umweltbilanz' };
  if (g === 'C') return { ampel: 'gelb', label: '🟡 Mittlere Umweltbilanz' };
  if (g === 'D' || g === 'E' || g === 'F') return { ampel: 'rot', label: '🔴 Hohe Umweltbelastung' };
  return { ampel: null, label: '⚪ Kein Öko-Score verfügbar' };
}

// Zeigt den farbigen Status-Banner oben in der Scan-Ergebniskarte — bei Obst/Gemüse anhand
// der Saisonalität, sonst anhand des Öko-Scores. So bekommt JEDES gescannte Produkt densel­ben
// Banner, statt dass er nur bei Saison-Treffern erscheint und sonst ganz fehlt.
function _renderScanSaisonBanner(saisonScore, grade) {
  const banner = document.getElementById('scan-saison-banner');
  if (!banner) return;
  banner.style.display = 'block';
  if (saisonScore) {
    const byAmpel = {
      gruen: ['🟢 Gerade in Saison', 'saison-gruen'],
      gelb:  ['🟡 Bedingt saisonal', 'saison-gelb'],
      rot:   ['🔴 Nicht in Saison', 'saison-rot'],
    }[saisonScore.ampel] || ['⚪ Unbekannt', ''];
    banner.textContent = byAmpel[0];
    banner.className = `scan-saison-banner ${byAmpel[1]}`;
  } else {
    const state = _ampelFromGrade(grade);
    banner.textContent = state.label;
    banner.className = `scan-saison-banner ${state.ampel ? 'saison-' + state.ampel : ''}`;
  }
}

// Zeigt beim Scannen, wo das Produkt gerade in Saison ist — und wenn das gescannte
// Produkt selbst nicht (voll) in Saison ist, zusätzlich in Saison befindliche Alternativen
// aus derselben Kategorie (dieselben Bausteine wie auf der Produkt-Detailseite).
function _renderScanSaisonExtra(produkt, saisonScore) {
  const container = document.getElementById('scan-saison-extra');
  if (!container) return;
  if (!produkt) { container.innerHTML = ''; return; }

  const MN = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const monat = new Date().getMonth() + 1;
  const { inCard } = _buildLaenderCards(produkt, monat, MN);

  let alternativenHtml = '';
  if (saisonScore?.ampel !== 'gruen') {
    const alternativen = _findeAlternativen(produkt.id);
    if (alternativen.length) {
      alternativenHtml = `
        <div class="card detail-insaison-card">
          <div class="detail-card-label">Gerade in Saison (${produkt.kategorie.replace(/_/g,' ')})</div>
          ${alternativen.map(a => `
            <div class="detail-land-row" onclick="showFoodDetails('${a.id}')" style="cursor:pointer">
              <span class="detail-land-dot">${_getProduktEmoji(a)}</span>
              <span class="detail-land-name" style="color:var(--green-dark);font-weight:500">${a.name}</span>
              <span class="detail-land-phase" style="color:var(--green-dark)">🟢</span>
            </div>`).join('')}
        </div>`;
    }
  }

  container.innerHTML = inCard + alternativenHtml;
}

function initScanTab() {
  const result = document.getElementById('scan-result');
  if (result) result.style.display = 'none';
}

// Blendet das aktuell angezeigte Scan-Ergebnis aus und startet die Kamera direkt neu,
// damit ohne Umweg über "Kamera starten" gleich der nächste Artikel gescannt werden kann.
function dismissScanResult() {
  startScanner();
}

// Klick außerhalb der Ergebnis-Karte schließt sie genauso wie das ✕ — #scan-start-btn
// ausgenommen, da startScanner() das Ergebnis beim Neustart der Kamera ohnehin schon
// schließt und es sonst doppelt (und ggf. mit Kamera-Race-Condition) ausgelöst würde.
document.addEventListener('click', (e) => {
  const resultEl = document.getElementById('scan-result');
  if (!resultEl || resultEl.style.display !== 'block') return;
  if (resultEl.contains(e.target)) return;
  if (e.target.closest('#scan-start-btn')) return;
  dismissScanResult();
});

async function startScanner() {
  if (typeof ZXing === 'undefined') {
    setScanStatus('Scanner konnte nicht geladen werden.');
    return;
  }

  // Vorheriges Scan-Ergebnis immer schließen, wenn die Kamera (neu) startet — egal ob über
  // "Kamera starten" oder den ✕-Button —, sonst bleibt z. B. eine alte "Nicht in der
  // Datenbank"-Meldung sichtbar stehen und es sieht so aus, als würde sie ständig erscheinen.
  const prevResult = document.getElementById('scan-result');
  if (prevResult) prevResult.style.display = 'none';
  const prevMsg = document.getElementById('scan-success-message');
  if (prevMsg) { prevMsg.textContent = ''; prevMsg.className = 'scan-success-message'; }
  const prevGm = document.getElementById('scan-gm-extra');
  if (prevGm) prevGm.innerHTML = '';
  // Kurze Sperrfrist: das vorher gescannte Produkt hängt oft noch im Kamerabild, sonst würde
  // es sofort wieder erkannt und dasselbe Ergebnis ginge direkt erneut auf.
  _scanResumeAt = Date.now() + 1500;

  const startBtn = document.getElementById('scan-start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Starte…';
  }
  setScanStatus('Kamera-Berechtigung wird angefragt…');

  try {
    const reader = new ZXing.BrowserMultiFormatReader();
    _scanActive   = true;
    const videoEl = document.getElementById('scan-video');
    const onDecode = (result, err) => {
      if (result && _scanActive && Date.now() >= _scanResumeAt) {
        _scanActive = false;
        stopScanner();
        applyScanResult(result.getText());
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.warn('ZXing:', err);
      }
    };

    try {
      // Manche Android-Kameras (v. a. Samsung) stellen ohne expliziten Hinweis nicht
      // kontinuierlich scharf — decodeFromVideoDevice() fragt intern nur { facingMode:
      // 'environment' } an, ohne Fokus-Constraint. Hier direkt mit Fokus-Hinweis anfragen.
      _scanControls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment', advanced: [{ focusMode: 'continuous' }] } },
        videoEl,
        onDecode
      );
    } catch (constraintErr) {
      // Fallback für Geräte/Browser, die die erweiterten Constraints ablehnen.
      _scanControls = await reader.decodeFromVideoDevice(null, videoEl, onDecode);
    }

    const overlay = document.getElementById('scan-overlay');
    const scanLine = document.getElementById('scan-line');
    if (overlay) overlay.style.display = 'none';
    if (scanLine) scanLine.style.display = 'block';

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></svg> Stoppen`;
      startBtn.onclick = stopScanner;
    }
    setScanStatus('Barcode in den Rahmen halten…');

  } catch (err) {
    stopScanner();
    let msg = 'Kamera konnte nicht gestartet werden.';
    if (err.name === 'NotAllowedError') msg = 'Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.';
    else if (err.name === 'NotFoundError') msg = 'Keine Kamera gefunden.';
    setScanStatus(msg);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'Kamera starten';
    }
  }
}

function stopScanner() {
  _scanActive = false;
  if (_scanControls) { _scanControls.stop(); _scanControls = null; }
  // ZXing's controls.stop() allein beendet nicht zuverlässig den Kamera-Stream (Track bleibt
  // "live", die Kamera filmt weiter) — Video-Element-Stream deshalb zusätzlich manuell stoppen.
  const scanVideo = document.getElementById('scan-video');
  if (scanVideo?.srcObject) { scanVideo.srcObject.getTracks().forEach(t => t.stop()); scanVideo.srcObject = null; }

  const overlay = document.getElementById('scan-overlay');
  const scanLine = document.getElementById('scan-line');
  const startBtn = document.getElementById('scan-start-btn');

  if (overlay) overlay.style.display = 'flex';
  if (scanLine) scanLine.style.display = 'none';
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.onclick = startScanner;
    startBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg> Kamera starten`;
  }
  setScanStatus('');
}


// Ein Eingabefeld für beide Codetypen — PLU-Codes sind immer 4–5-stellig, Barcodes
// (EAN-8/12/13) immer mindestens 8-stellig, es gibt also keine Überschneidung und die
// Länge allein reicht, um zuverlässig zu unterscheiden, welcher Lookup gebraucht wird.
function submitCode() {
  const val = (document.getElementById('code-input')?.value || '').replace(/\D/g, '');
  if (!val) {
    setScanStatus('Bitte Barcode oder PLU-Nummer eingeben.');
    return;
  }
  if (val.length === 4 || val.length === 5) {
    stopScanner();
    applyPluLookup(parseInt(val, 10));
  } else if (val.length >= 8) {
    stopScanner();
    applyScanResult(val);
  } else {
    setScanStatus('Ungültiges Format (PLU: 4–5 Stellen, Barcode: mind. 8 Stellen).');
  }
}

function applyPluLookup(plu) {
  const resultEl = document.getElementById('scan-result');
  if (resultEl) resultEl.style.display = 'none';

  if (!_saisondaten || !_pluDaten) {
    setScanStatus('Daten werden geladen…');
    setTimeout(() => applyPluLookup(plu), 800);
    return;
  }

  // Organic detection: 5-digit code starting with 9 = bio
  const pluStr = String(plu);
  const isBio = pluStr.length === 5 && pluStr.startsWith('9');
  const basePlu = isBio ? parseInt(pluStr.slice(1), 10) : plu;

  const pluEintrag = _pluDaten.codes[String(basePlu)];
  const produkt = pluEintrag
    ? _saisondaten.produkte.find(p => p.id === pluEintrag.saisondaten_id)
    : null;

  if (!produkt) {
    renderScanError(pluStr,
      `PLU ${pluStr} nicht in der Datenbank. Versuche den Barcode-Scanner oder schau im Saisonkalender nach.`
    );
    return;
  }

  const monat = new Date().getMonth() + 1;
  const saisonScore = _calculateSaisonScore(produkt, []);
  const inSeasonCountries = produkt.laender
    .filter(l => _getPhaseForMonth(l, monat)).map(l => l.land);
  const herkunft = (inSeasonCountries.length ? inSeasonCountries : produkt.laender.map(l => l.land)).join(', ');
  const bioLabel = isBio ? '🌿 Bio' : 'Konventionell';
  // Show variety name from plu-codes.json (e.g. "Apfel (Gala)")
  const anzeigeName = pluEintrag?.name || produkt.name;

  // Öko-Score-Badge bleibt sichtbar (mit "?"), auch wenn lose Ware keinen Wert hat —
  // damit jede gescannte Karte denselben Aufbau hat.
  const badge = document.getElementById('scan-ecoscore-badge');
  if (badge) { badge.style.display = ''; badge.className = 'scan-result-score-badge'; }

  document.getElementById('scan-result-icon').innerHTML  = _getProduktEmoji(produkt);
  document.getElementById('scan-result-name').textContent  = anzeigeName;
  document.getElementById('scan-result-brand').textContent = `PLU ${pluStr} · ${bioLabel}`;
  document.getElementById('scan-result-score').textContent = '?';
  document.getElementById('scan-origins').textContent      = herkunft || '–';
  document.getElementById('scan-category').textContent     = produkt.kategorie.replace(/_/g, ' ');
  document.getElementById('scan-nutriscore').textContent   = '–';

  _renderScanSaisonBanner(saisonScore, null);
  _renderScanSaisonExtra(produkt, saisonScore);

  const saisonRow = document.getElementById('scan-saison-row');
  const saisonEl  = document.getElementById('scan-saison');
  if (saisonRow && saisonEl) {
    if (saisonScore) {
      const dot = { gruen: '🟢', gelb: '🟡', rot: '🔴' }[saisonScore.ampel] || '⚪';
      saisonEl.textContent = `${dot} ${saisonScore.land}`;
    } else {
      saisonEl.textContent = '–';
    }
    saisonRow.style.display = 'flex';
  }

  const msgEl = document.getElementById('scan-success-message');
  if (saisonScore) {
    msgEl.textContent = saisonScore.text;
    msgEl.className   = `scan-success-message ampel-${saisonScore.ampel}`;
  } else {
    msgEl.textContent = '✦ Nicht in Saison für diesen Monat.';
    msgEl.className   = 'scan-success-message ampel-rot';
  }

  const addBtn = document.getElementById('scan-add-btn');
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.textContent   = '+ Zur Einkaufsliste hinzufügen';
    addBtn.onclick       = () => addItem(produkt.name);
  }

  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  setScanStatus(`PLU ${pluStr} erkannt ✓${isBio ? ' · Bio' : ''}`);
  if (typeof gmOnScan === 'function') {
    gmOnScan({ source: 'plu', code: pluStr, name: produkt.name, produktId: produkt.id, ampel: saisonScore?.ampel || null, grade: null, bio: isBio });
  }
}

const KATEGORIE_EMOJI = {
  'Beeren':          '🍓',
  'Kernobst':        '🍎',
  'Steinobst':       '🍑',
  'Sonstiges_Obst':  '🍇',
  'Zitrusfruechte':  '🍊',
  'Exotische_Fruechte': '🥭',
  'Fruchtgemuese':   '🍅',
  'Kohlgemuese':     '🥦',
  'Wurzelgemuese':   '🥕',
  'Salate':          '🥬',
  'Huelsenfruechte': '🫘',
  'Sonstiges_Gemuese': '🌿',
};

const PRODUKT_EMOJI = {
  'birne':             '🍐',
  'quitte':            '🍐',
  'kirsche':           '🍒',
  'pfirsich':          '🍑',
  'aprikose':          '🍑',
  'nektarine':         '🍑',
  'mirabelle':         '🍑',
  'pflaume':           '🫐',
  'erdbeere':          '🍓',
  'heidelbeere':       '🫐',
  'brombeere':         '🫐',
  'himbeere':          '🍓',
  'johannisbeere':     '🍇',
  'stachelbeere':      '🍈',
  'physalis':          '🍊',
  'tafeltraube':       '🍇',
  'kiwi':              '🥝',
  'wassermelone':      '🍉',
  'melone':            '🍈',
  'feige':             '🍇',
  'kaki':              '🍊',
  'granatapfel':       '🍎',
  'passionsfrucht':    '🍋',
  'orange':            '🍊',
  'limette':           '🍋',
  'grapefruit':        '🍊',
  'mango':             '🥭',
  'avocado':           '🥑',
  'banane':            '🍌',
  'ananas':            '🍍',
  'papaya':            '🥭',
  'gurke':             '🥒',
  'kuerbis':           '🎃',
  'zucchini':          '🥒',
  'zuckermais':        '🌽',
  'paprika':           '🫑',
  'aubergine':         '🍆',
  'kartoffel':         '🥔',
  'zwiebel':           '🧅',
  'fruehlingszwiebel': '🧅',
  'topinambur':        '🥔',
  'champignon':        '🍄',
  'erbse':             '🫛',
  'zuckerschote':      '🫛',
  'spinat':            '🥬',
  'mangold':           '🥬',
  'chinakohl':         '🥬',
};

function _getProduktEmoji(p) {
  return PRODUKT_EMOJI[p.id] || KATEGORIE_EMOJI[p.kategorie] || '🛒';
}

function applyPluResult(query) {
  const resultEl = document.getElementById('scan-result');
  if (resultEl) resultEl.style.display = 'none';

  if (!_saisondaten) {
    setScanStatus('Saisondaten werden geladen, bitte kurz warten…');
    setTimeout(() => applyPluResult(query), 800);
    return;
  }

  const produkt = _matchSaisondatenByName(query);
  if (!produkt) {
    renderScanError(query, `„${query}" nicht in der Datenbank gefunden. Versuche einen anderen Begriff (z. B. „Tomate", „Apfel", „Gurke").`);
    return;
  }

  const monat = new Date().getMonth() + 1;
  const saisonScore = _calculateSaisonScore(produkt, []);

  // Countries with any active phase this month, fallback to all
  const inSeasonCountries = produkt.laender
    .filter(l => _getPhaseForMonth(l, monat))
    .map(l => l.land);
  const herkunft = (inSeasonCountries.length ? inSeasonCountries : produkt.laender.map(l => l.land)).join(', ');

  // Ecoscore badge — hide for PLU (no ecoscore available)
  // Öko-Score-Badge bleibt sichtbar (mit "?"), auch wenn lose Ware keinen Wert hat —
  // damit jede gescannte Karte denselben Aufbau hat.
  const badge = document.getElementById('scan-ecoscore-badge');
  if (badge) { badge.style.display = ''; badge.className = 'scan-result-score-badge'; }

  document.getElementById('scan-result-icon').innerHTML  = _getProduktEmoji(produkt);
  document.getElementById('scan-result-name').textContent  = produkt.name;
  document.getElementById('scan-result-brand').textContent = produkt.kategorie.replace(/_/g, ' ');
  document.getElementById('scan-result-score').textContent = '?';
  document.getElementById('scan-origins').textContent      = herkunft || 'Nicht angegeben';
  document.getElementById('scan-category').textContent     = produkt.kategorie.replace(/_/g, ' ');
  document.getElementById('scan-nutriscore').textContent   = '–';

  _renderScanSaisonBanner(saisonScore, null);
  _renderScanSaisonExtra(produkt, saisonScore);

  const saisonRow = document.getElementById('scan-saison-row');
  const saisonEl  = document.getElementById('scan-saison');
  if (saisonRow && saisonEl) {
    if (saisonScore) {
      const dot = { gruen: '🟢', gelb: '🟡', rot: '🔴' }[saisonScore.ampel] || '⚪';
      saisonEl.textContent = `${dot} ${saisonScore.land}`;
    } else {
      saisonEl.textContent = '–';
    }
    saisonRow.style.display = 'flex';
  }

  const msgEl = document.getElementById('scan-success-message');
  if (saisonScore) {
    msgEl.textContent = saisonScore.text;
    msgEl.className   = `scan-success-message ampel-${saisonScore.ampel}`;
  } else {
    msgEl.textContent = '✦ Nicht in Saison für diesen Monat.';
    msgEl.className   = 'scan-success-message ampel-rot';
  }

  const addBtn = document.getElementById('scan-add-btn');
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.textContent   = '+ Zur Einkaufsliste hinzufügen';
    addBtn.onclick       = () => addItem(produkt.name);
  }

  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  setScanStatus(`„${query}" gefunden ✓`);
  if (typeof gmOnScan === 'function') {
    gmOnScan({ source: 'name', code: null, name: produkt.name, produktId: produkt.id, ampel: saisonScore?.ampel || null, grade: null, bio: false });
  }
}

async function applyScanResult(barcode) {
  // Schutz gegen überholte Antworten: wenn währenddessen schon ein neuerer Scan läuft,
  // darf diese (u. U. langsamere) Fetch-Antwort das bereits neuere Ergebnis nicht mehr
  // überschreiben — sonst kann beim zweiten Scan plötzlich wieder das vorherige Produkt
  // erscheinen, je nachdem welche Anfrage zuerst durchkommt.
  const requestId = ++_scanRequestId;

  setScanStatus('Produkt wird gesucht…');
  const resultEl = document.getElementById('scan-result');
  if (resultEl) resultEl.style.display = 'none';

  // Datenabruf: zuerst eigenes Backend (api/scan.php: Cache + Preise), sonst direkt
  // Open Food Facts + Open Prices aus dem Browser (scanLookup in features.js).
  const result = await scanLookup(barcode);
  if (requestId !== _scanRequestId) return;

  if (result.error) {
    renderScanError(barcode, result.message);
    return;
  }
  renderScanResult(result.product, barcode);
  if (typeof scanRenderEnrichment === 'function') scanRenderEnrichment(result.product, result);
}

// Zeigt einen Fehler-Popup statt der Ergebniskarte, wenn ein Scan nicht erfolgreich war
// (Produkt nicht gefunden, keine Verbindung, …). "Erneut versuchen" startet die Kamera
// direkt neu, damit man ohne Umweg weiterscannen kann.
function renderScanError(barcode, message) {
  setScanStatus('');

  const overlay = document.createElement('div');
  overlay.className = 'shopping-done-overlay';
  overlay.onclick = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.innerHTML = `
    <div class="shopping-done-sheet" onclick="event.stopPropagation()" style="text-align:center;padding:28px 24px">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <h3 style="margin-bottom:8px">Scan nicht erfolgreich</h3>
      <p style="color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:20px">${escapeHtml(message)}</p>
      <button class="shopping-done-yes" style="width:100%" onclick="event.stopPropagation();this.closest('.shopping-done-overlay').classList.remove('open');setTimeout(()=>this.closest('.shopping-done-overlay')?.remove(),200);startScanner()">Erneut versuchen</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function renderScanResult(p, barcode) {
  const name  = p.product_name_de || p.product_name || 'Unbekanntes Produkt';
  const brand = [p.brands, p.quantity].filter(Boolean).join(' · ') || `EAN: ${barcode}`;
  const grade = (p.ecoscore_grade || '').replace(/not-applicable|unknown/i, '').toUpperCase() || '?';
  const nutri = (p.nutriscore_grade || '?').toUpperCase();

  // origins_tags is much more reliable than the free-text origins field
  const originCountries = _parseOriginCountries(p.origins_tags);
  const originsText = originCountries.length > 0
    ? originCountries.join(', ')
    : (p.origins || p.manufacturing_places || 'Nicht angegeben');

  const category = _formatCategory(p.categories_tags);

  // Saison scoring via saisondaten.json
  const saisonMatch = _matchSaisondaten(name, p.categories_tags);
  const saisonScore = saisonMatch ? _calculateSaisonScore(saisonMatch, originCountries) : null;

  // Populate result panel
  document.getElementById('scan-result-icon').innerHTML  = saisonMatch ? _getProduktEmoji(saisonMatch) : _categoryEmoji(p.categories_tags);
  document.getElementById('scan-result-name').textContent  = name;
  document.getElementById('scan-result-brand').textContent = brand;
  document.getElementById('scan-result-score').textContent = grade.replace('-PLUS', '+');   // OFF: a-plus … f
  document.getElementById('scan-origins').textContent      = originsText;
  document.getElementById('scan-category').textContent     = category;
  document.getElementById('scan-nutriscore').textContent   = nutri !== '?' ? `Score ${nutri}` : 'Nicht verfügbar';

  _renderScanSaisonBanner(saisonScore, grade);
  _renderScanSaisonExtra(saisonMatch, saisonScore);

  // Saison row — immer sichtbar, mit "–" wenn keine Saisondaten vorliegen (z. B. Getränke),
  // damit jedes Produkt dieselben Zeilen zeigt statt die Zeile teils ganz wegzulassen.
  const saisonRow = document.getElementById('scan-saison-row');
  const saisonEl  = document.getElementById('scan-saison');
  if (saisonRow && saisonEl) {
    if (saisonScore) {
      const dot = { gruen: '🟢', gelb: '🟡', rot: '🔴' }[saisonScore.ampel] || '⚪';
      saisonEl.textContent = `${dot} ${saisonScore.land}`;
    } else {
      saisonEl.textContent = '–';
    }
    saisonRow.style.display = 'flex';
  }

  // Message: saison text takes priority, fallback to ecoscore message
  const msgEl = document.getElementById('scan-success-message');
  if (saisonScore) {
    msgEl.textContent = saisonScore.text;
    msgEl.className   = `scan-success-message ampel-${saisonScore.ampel}`;
  } else if (saisonMatch) {
    msgEl.textContent = '✦ Nicht in Saison für diesen Monat.';
    msgEl.className   = 'scan-success-message ampel-rot';
  } else {
    msgEl.textContent = _ecoscoreMsg(grade);
    const state = _ampelFromGrade(grade);
    msgEl.className = `scan-success-message${state.ampel ? ' ampel-' + state.ampel : ''}`;
  }

  const badge = document.getElementById('scan-ecoscore-badge');
  if (badge) {
    badge.style.display = '';
    badge.className = `scan-result-score-badge ecoscore-${grade.toLowerCase()}`;
  }

  const addBtn = document.getElementById('scan-add-btn');
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.textContent   = '+ Zur Einkaufsliste hinzufügen';
    addBtn.onclick       = () => addItem(name);
  }

  const resultEl = document.getElementById('scan-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  setScanStatus('Barcode erkannt ✓');
  if (typeof gmOnScan === 'function') {
    gmOnScan({ source: 'barcode', code: barcode, name, produktId: saisonMatch?.id || null, ampel: saisonScore?.ampel || null, grade: grade !== '?' ? grade : null, bio: false });
  }
}

function _formatCategory(tags) {
  if (!tags || !tags.length) return 'Unbekannt';
  const deTags = tags.filter(t => t.startsWith('de:'));
  const enTags = tags.filter(t => t.startsWith('en:'));
  const tag = (deTags[deTags.length - 1] || enTags[enTags.length - 1] || tags[tags.length - 1]);
  return tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function _categoryEmoji(tags) {
  if (!tags) return '🛒';
  const s = tags.join(' ').toLowerCase();
  if (/milk|milch|dairy|oat.drink|hafermilch/.test(s)) return '🥛';
  if (/meat|fleisch|beef|pork|chicken|poultry/.test(s)) return '🥩';
  if (/fish|fisch|seafood|meeresfrüchte/.test(s)) return '🐟';
  // Spezifische Gemüse-/Obstsorten VOR den generischen "vegetable"/"fruit"-Treffern prüfen,
  // sonst landet wegen der breiten OFF-Kategorisierung fast alles beim selben Emoji.
  if (/tomato|tomate/.test(s)) return '🍅';
  if (/carrot|karott|möhre|moehre/.test(s)) return '🥕';
  if (/potato|kartoffel/.test(s)) return '🥔';
  if (/onion|zwiebel/.test(s)) return '🧅';
  if (/cucumber|gurke|zucchini|courgette/.test(s)) return '🥒';
  if (/pepper|paprika/.test(s)) return '🫑';
  if (/salad|lettuce|salat/.test(s)) return '🥬';
  if (/broccoli|brokkoli|cauliflower|blumenkohl|cabbage|kohl/.test(s)) return '🥦';
  if (/mushroom|pilz|champignon/.test(s)) return '🍄';
  if (/apple|apfel/.test(s)) return '🍎';
  if (/banana|banane/.test(s)) return '🍌';
  if (/citrus|orange|zitrone|lemon|limette|lime/.test(s)) return '🍊';
  if (/berry|beere/.test(s)) return '🍓';
  if (/grape|traube/.test(s)) return '🍇';
  if (/melon|melone/.test(s)) return '🍉';
  if (/vegetable|gemüse/.test(s)) return '🥦';
  if (/fruit|obst/.test(s)) return '🍎';
  if (/bread|brot|bakery|bäckerei/.test(s)) return '🍞';
  if (/chocolate|schokolade/.test(s)) return '🍫';
  if (/beverage|getränk|drink|juice|saft/.test(s)) return '🥤';
  if (/cheese|käse/.test(s)) return '🧀';
  if (/egg|ei/.test(s)) return '🥚';
  if (/pasta|nudel/.test(s)) return '🍝';
  if (/legume|hülsenfrucht|bean|bohne|lentil|linse|tofu|soy|soja/.test(s)) return '🫘';
  return '🛒';
}

function _ecoscoreMsg(grade) {
  return {
    'A-PLUS': '✦ Hervorragende Umweltbilanz — beste Wahl!',
    'A': '✦ Ausgezeichnete Umweltbilanz — sehr gute Wahl!',
    'B': '✦ Gute Umweltbilanz — nachhaltige Entscheidung.',
    'C': '✦ Mittlere Umweltbilanz — öfter Alternativen wählen.',
    'D': '✦ Hohe Umweltbelastung — gelegentlich besser meiden.',
    'E': '✦ Sehr hohe Umweltbelastung — Alternativen bevorzugen.',
    'F': '✦ Sehr hohe Umweltbelastung — Alternativen bevorzugen.',
  }[grade] || '✦ Kein Öko-Score für dieses Produkt verfügbar.';
}

function setScanStatus(msg) {
  const el = document.getElementById('scan-status');
  if (el) el.textContent = msg;
}

function initChallengesOnHome() {
  checkWeeklyReset();
  _updateDailyStarBadge();
  // Set weekly myth
  const myth = getWeeklyMyth();
  const titleEl = document.getElementById('weekly-myth-title');
  const textEl = document.getElementById('weekly-myth-text');

  if (titleEl) titleEl.textContent = myth.title;
  if (textEl) textEl.textContent = myth.text;

  // Render selected challenges
  renderSelectedChallenges();
}

/* ══════════════════════════════════════════
   ERNAEHRUNG DETAIL & SUGGESTION
   ══════════════════════════════════════════ */

function _buildErnaehrungCard(ern, itemId) {
  const isVegan = ern.vegan;
  const isVeg   = ern.vegetarisch && !isVegan;
  const tag = isVegan
    ? '<span class="ern-tag ern-vegan">Vegan</span>'
    : isVeg
    ? '<span class="ern-tag ern-veg">Vegetarisch</span>'
    : '<span class="ern-tag ern-fleisch">Tierisch</span>';

  const alt = ern.alternativen;
  const vegAlts  = alt?.vegetarisch || [];
  const veganAlts = alt?.vegan || [];
  const showAlts = veganAlts.length || vegAlts.length;

  // CO₂ bar
  const CO2_MAX = 85;
  let co2Html = '';
  if (ern.umwelt?.co2_kg != null) {
    const pct = Math.min(100, Math.round(ern.umwelt.co2_kg / CO2_MAX * 100));
    const co2 = ern.umwelt.co2_kg;
    const barColor = co2 >= 20 ? '#c0392b' : co2 >= 8 ? '#d68910' : co2 >= 3 ? '#b7950b' : '#27ae60';
    const cmpHtml = ern.vergleich
      ? (() => {
          const factor = Math.round(co2 / ern.vergleich.co2 * 10) / 10;
          const fmtFactor = factor % 1 === 0 ? factor.toFixed(0) : factor.toFixed(1).replace('.', ',');
          return `<div class="co2-vergleich">${fmtFactor}× mehr CO₂ als ${escapeHtml(ern.vergleich.name)} (${String(ern.vergleich.co2).replace('.', ',')} kg)</div>`;
        })()
      : '';
    const einheit = ern.umwelt?.einheit || 'pro kg';
    const umweltVergleichHtml = ern.umwelt_vergleich ? (() => {
      const u = ern.umwelt;
      const rows = ern.umwelt_vergleich.map(v => {
        const co2Pct  = Math.min(100, Math.round(v.co2_kg       / u.co2_kg        * 100));
        const landPct = Math.min(100, Math.round(v.land_m2      / u.land_m2       * 100));
        const wassPct = Math.min(100, Math.round(v.wasser_l     / u.wasser_l      * 100));
        const eutPct  = Math.min(100, Math.round(v.eutrophierung_kg / u.eutrophierung_kg * 100));
        const best = co2Pct <= 35 && wassPct <= 10;
        return `<tr class="umwelt-row${best ? ' umwelt-row-best' : ''}">
          <td class="umwelt-name">${v.emoji || ''} ${escapeHtml(v.name)}</td>
          <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:${co2Pct}%"></div></td>
          <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:${landPct}%"></div></td>
          <td class="umwelt-bar-cell"><div class="umwelt-mini-bar umwelt-bar-wasser" style="width:${wassPct}%"></div></td>
          <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:${eutPct}%"></div></td>
        </tr>`;
      }).join('');
      return `
        <div class="umwelt-vergleich-block">
          <div class="umwelt-vergleich-title">Pflanzliche Alternativen im Vergleich</div>
          <table class="umwelt-table">
            <thead><tr>
              <th></th>
              <th title="Treibhausgasemissionen">CO₂</th>
              <th title="Landnutzung">Land</th>
              <th title="Süßwasserverbrauch" class="umwelt-th-warn">Wasser</th>
              <th title="Eutrophierung">Eutro.</th>
            </tr></thead>
            <tbody>
              <tr class="umwelt-row umwelt-row-kuh">
                <td class="umwelt-name">🐄 Kuhmilch</td>
                <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:100%"></div></td>
                <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:100%"></div></td>
                <td class="umwelt-bar-cell"><div class="umwelt-mini-bar umwelt-bar-wasser" style="width:100%"></div></td>
                <td class="umwelt-bar-cell"><div class="umwelt-mini-bar" style="width:100%"></div></td>
              </tr>
              ${rows}
            </tbody>
          </table>
          <div class="umwelt-legende">Balken = relativ zu Kuhmilch &nbsp;·&nbsp; 🏆 Hafermilch ist overall beste Wahl</div>
        </div>`;
    })() : '';

    co2Html = `
      <div class="co2-block">
        <div class="co2-header">
          <span class="co2-label">Produktemissionen</span>
          <span class="co2-value" style="color:${barColor}">${String(co2).replace('.', ',')} kg CO₂ <span style="font-weight:400;font-size:11px">/ kg Produkt</span></span>
        </div>
        <div class="co2-bar-wrap">
          <div class="co2-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        ${cmpHtml}
        ${ern.impact ? `<div class="co2-impact">${escapeHtml(ern.impact)}</div>` : ''}
        ${umweltVergleichHtml}
      </div>`;
  }

  return `
    <div class="card">
      <div class="detail-card-label" style="display:flex;align-items:center;gap:8px">
        ${ern.emoji || ''} ${escapeHtml(ern.name)} ${tag}
      </div>
      ${co2Html}
    </div>
    ${showAlts ? `
    <div class="card">
      <div class="detail-card-label">Pflanzliche Alternativen</div>
      ${veganAlts.map(a => {
        const canSwap = itemId != null;
        const safeName = a.replace(/'/g, "\\'");
        return `
        <div class="detail-land-row alt-swap-row${canSwap ? ' alt-swappable' : ''}" ${canSwap ? `onclick="swapToAlternative(${itemId},'${safeName}','${ern.id}')"` : ''}>
          <span class="detail-land-dot">🌱</span>
          <span class="detail-land-name">${escapeHtml(a)}</span>
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
            <span class="ern-tag ern-vegan" style="font-size:10px">Vegan</span>
            ${canSwap ? `<span class="alt-swap-arrow"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></span>` : ''}
          </div>
        </div>`;
      }).join('')}
      ${vegAlts.filter(v => !veganAlts.includes(v)).map(a => {
        const canSwap = itemId != null;
        const safeName = a.replace(/'/g, "\\'");
        return `
        <div class="detail-land-row alt-swap-row${canSwap ? ' alt-swappable' : ''}" ${canSwap ? `onclick="swapToAlternative(${itemId},'${safeName}','${ern.id}')"` : ''}>
          <span class="detail-land-dot">🥚</span>
          <span class="detail-land-name">${escapeHtml(a)}</span>
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
            <span class="ern-tag ern-veg" style="font-size:10px">Veg.</span>
            ${canSwap ? `<span class="alt-swap-arrow"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></span>` : ''}
          </div>
        </div>`;
      }).join('')}
      ${alt?.hinweis ? `<div style="font-size:12px;color:var(--muted);margin-top:10px;padding-top:8px;border-top:0.5px solid var(--border);line-height:1.5">💡 ${escapeHtml(alt.hinweis)}</div>` : ''}
    </div>` : ''}`;
}

// Called when user taps a "Meintest du?" chip — updates item and refreshes
function applySuggestion(itemId, suggestedName) {
  const item = listItems.find(e => e.id === itemId);
  if (!item) return;
  item.text = suggestedName;
  const produkt = _matchSaisondatenByName(suggestedName);
  if (produkt && _saisondaten) {
    const score = _calculateSaisonScore(produkt, []);
    item.ampel     = score?.ampel || null;
    item.saisonText = score?.text || null;
    item.produktId  = produkt.id;
  }
  saveList();
  showListItemDetails(itemId);
}

// Called when user taps an alternative in the ernaehrung card — swaps item to the better choice
function swapToAlternative(itemId, altName, fromErnId) {
  const item = listItems.find(e => e.id === itemId);
  if (!item) return;

  // Store what was swapped from (for score calculation later)
  item.ecoSwap = { from: item.text, fromErnId, to: altName };

  item.text = altName;
  item.ampel = null;
  item.saisonText = null;
  item.produktId = null;

  // Try to match in saisondaten
  const produkt = _matchSaisondatenByName(altName);
  if (produkt && _saisondaten) {
    const score = _calculateSaisonScore(produkt, []);
    item.ampel      = score?.ampel || null;
    item.saisonText = score?.text || null;
    item.produktId  = produkt.id;
  }

  saveList();
  _trackGoodDecision();
  if (typeof gmOnGoodChoice === 'function') gmOnGoodChoice();
  _showToast(`🌱 ${escapeHtml(altName)} eingetragen`);
  showScreen('list');
}

function _trackGoodDecision() {
  const now = Date.now();
  const data = JSON.parse(localStorage.getItem('gruenkorb-daily-decisions') || '{"startTime":0,"count":0}');
  const elapsed = now - (data.startTime || 0);
  if (elapsed > 86400000) { data.startTime = now; data.count = 0; }
  data.count += 1;
  localStorage.setItem('gruenkorb-daily-decisions', JSON.stringify(data));
  if (data.count === 5) {
    setTimeout(() => _showToast('⭐ Tagesheld! 5 gute Entscheidungen heute!'), 300);
  }
  _updateDailyStarBadge();
}

function showStarPopup() {
  const data = JSON.parse(localStorage.getItem('gruenkorb-daily-decisions') || '{"startTime":0,"count":0}');
  const count = data.count || 0;
  const earned = new Date(data.startTime || Date.now());
  const timeStr = earned.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const overlay = document.createElement('div');
  overlay.className = 'shopping-done-overlay';
  overlay.onclick = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.innerHTML = `
    <div class="shopping-done-sheet" onclick="event.stopPropagation()" style="text-align:center;padding:28px 24px">
      <div style="font-size:48px;margin-bottom:12px">⭐</div>
      <h3 style="margin-bottom:8px">Tagesheld!</h3>
      <p style="color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:20px">
        Du hast heute <strong>${count} gute Entscheidungen</strong> getroffen – bewusste Alternativen gewählt und nachhaltig eingekauft.<br><br>
        <span style="font-size:12px">Verdient um ${timeStr} Uhr · Reset nach 24 Stunden</span>
      </p>
      <button class="shopping-done-yes" style="width:100%" onclick="event.stopPropagation();this.closest('.shopping-done-overlay').classList.remove('open');setTimeout(()=>this.closest('.shopping-done-overlay')?.remove(),200)">Super, danke!</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function _updateDailyStarBadge() {
  const badge = document.getElementById('daily-star-badge');
  if (!badge) return;
  const now = Date.now();
  const data = JSON.parse(localStorage.getItem('gruenkorb-daily-decisions') || '{"startTime":0,"count":0}');
  const active = data.count >= 5 && (now - (data.startTime || 0)) <= 86400000;
  badge.style.display = active ? 'inline-flex' : 'none';
}

function _showToast(msg) {
  const existing = document.getElementById('gk-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'gk-toast';
  t.className = 'gk-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('gk-toast-visible'));
  setTimeout(() => {
    t.classList.remove('gk-toast-visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 2200);
}

/* ══════════════════════════════════════════
   WOCHEN-FUSSABDRUCK (CO₂ / Landnutzung / Wasser / Energie)
   ══════════════════════════════════════════ */

// Deutscher Wochendurchschnitt der GESAMTEN Ernährung (Getreide, Öle, Zucker, Kartoffeln
// u.a. eingeschlossen), recherchiert:
// CO₂:    ~1.700 kg/Jahr/Person (eatsmarter.de, Statista Treibhausgasbilanz) → /52
// Land:   ~2.022 m²/Jahr/Person (Umweltbundesamt Land-Fußabdruck) → /52
// Wasser: virtuelles Wasser der Ernährung (nicht Haushaltstrinkwasser), ~3.761 L/Tag bei
//         Mischkost (lebensraumwasser.com) → ×7
// Energie: 216 PJ/Jahr Energieaufwand deutsche Lebensmittelproduktion (123energie.de),
//          umgerechnet auf ~83 Mio. Einwohner → /52, in MJ statt kWh (216e15 J / 1e6 = MJ)
//
// Wird NUR noch als neutraler Ersatzwert für Artikel ohne jedes Produkt-Match verwendet
// (Nudeln, Gewürze, Essig, …, siehe _computeFootprintTotals) — für den eigentlichen
// Ø-Deutschland-Vergleich im Food-Profil siehe _computeReferenceWeeklyTotals(), die auf
// dem recherchierten Referenz-Warenkorb (warenkorb.json) basiert und dieselben
// Kategorie-/Produkt-Faktoren nutzt wie die Einkaufsberechnung selbst.
const FOOTPRINT_BASELINE_WEEKLY = {
  co2:     1700 / 52,
  land:    2022 / 52,
  wasser:  3761 * 7,
  energie: (216e15 / 1e6) / 83e6 / 52,
};

// Gesamter Lebensmittelverbrauch eines durchschnittlichen Deutschen (~975 kg/Jahr/Person,
// Statista/BZL) → /52. Nenner für den FOOTPRINT_BASELINE_WEEKLY-Ersatzwert oben.
const AVERAGE_WEEKLY_FOOD_KG = 975 / 52;

// Grobe Umrechnung gängiger Rezept-Einheiten in kg. Alles Unbekannte (Stück, Glas,
// Dose, …) fällt auf die produktspezifische portion_kg zurück.
const _UNIT_TO_KG = {
  g: 0.001, gramm: 0.001,
  kg: 1, kilogramm: 1,
  ml: 0.001, milliliter: 0.001,
  l: 1, liter: 1,
  el: 0.015, tl: 0.005,
};

// Mengeneinheiten, die IMMER klein sind, unabhängig vom Produkt — z. B. eine Knoblauchzehe
// wiegt ~5g, auch wenn das Produkt sonst (als "Sonstiges Gemüse") mit einer viel größeren
// Standardportion geführt wird (z. B. eine ganze Fenchelknolle). Ohne diese Tabelle würde
// "2 Knoblauchzehen" mit der Portionsgröße einer ganzen Knolle verrechnet (→ 600g statt ~10g).
const _SMALL_UNIT_KG = {
  zehe: 0.005, zehen: 0.005,
  prise: 0.001, msp: 0.001,
  spritzer: 0.005,
  blatt: 0.001, blätter: 0.001,
  zweig: 0.003, zweige: 0.003,
  scheibe: 0.02, scheiben: 0.02,
};

// Standardmenge für Artikel ganz ohne Mengenangabe (z. B. "Olivenöl", "Salz und Pfeffer",
// "Basilikum" ohne Zahl davor) — solche Angaben sind fast immer "nach Geschmack"/kleine
// Würz- oder Garnierungsmengen, kein 100g-Einkauf.
const _NO_AMOUNT_DEFAULT_KG = 0.02;

// Die Rezept-Analyse erkennt eine Einheit nur als eigenes Wort ("2 Zehen Knoblauch").
// Bei zusammengesetzten Wörtern ("Knoblauchzehe(n)", "Lorbeerblatt") landet die Einheit
// stattdessen unerkannt im Produktnamen — hier wird deshalb zusätzlich der Artikeltext
// nach denselben Klein-Mengen-Wörtern durchsucht.
function _smallUnitKgFromText(text) {
  const t = (text || '').toLowerCase();
  for (const word of Object.keys(_SMALL_UNIT_KG)) {
    if (t.includes(word)) return _SMALL_UNIT_KG[word];
  }
  return null;
}

// Liefert die Fußabdruck-Kennzahlen (co2_kg/land_m2/wasser_l/energie_mj pro kg + portion_kg)
// für einen Listenartikel, egal ob er aus ernaehrung.json oder saisondaten3.json stammt.
// Bei Obst/Gemüse wird der Kategorie-Basiswert ("regional, Ernte, Freiland") mit dem
// Multiplikator aus umwelt_faktoren für die aktuell wahrscheinlichste Bezugsquelle skaliert —
// dadurch macht sich eine außersaisonale/importierte Wahl auch in den vier Zahlen bemerkbar,
// statt nur in der Ampel-Farbe. Ist Herkunft bekannt (z. B. aus einem Barcode-Scan), wird sie
// übergeben; sonst nutzt _calculateSaisonScore dieselbe "beste aktuell verfügbare Option"-
// Annahme wie die Saison-Ampel selbst.
function _getFootprintData(text, originCountries) {
  const ernProdukt = _matchErnaehrung(text);
  if (ernProdukt?.umwelt) {
    return {
      co2_kg: ernProdukt.umwelt.co2_kg,
      land_m2: ernProdukt.umwelt.land_m2,
      wasser_l: ernProdukt.umwelt.wasser_l,
      energie_mj: ernProdukt.umwelt.energie_mj,
      portion_kg: ernProdukt.portion_kg,
    };
  }
  const saisonProdukt = _matchSaisondatenByName(text);
  const basis = _saisondaten?.kategorie_umwelt?.[saisonProdukt?.kategorie];
  if (!saisonProdukt || !basis) return null;
  const score = _calculateSaisonScore(saisonProdukt, originCountries || []);
  if (!score) {
    // Genau wie die graue "⚪"-Ampel anderswo in der App: das Produkt hat gerade nirgends
    // eine bekannte aktive Phase (z. B. Rosenkohl im Hochsommer) — dann NICHT optimistisch
    // mit dem Bestwert rechnen, sondern neutral mit derselben Durchschnittsintensität wie
    // bei komplett unbekannten Artikeln (siehe _computeFootprintTotals).
    return {
      co2_kg: FOOTPRINT_BASELINE_WEEKLY.co2 / AVERAGE_WEEKLY_FOOD_KG,
      land_m2: FOOTPRINT_BASELINE_WEEKLY.land / AVERAGE_WEEKLY_FOOD_KG,
      wasser_l: FOOTPRINT_BASELINE_WEEKLY.wasser / AVERAGE_WEEKLY_FOOD_KG,
      energie_mj: FOOTPRINT_BASELINE_WEEKLY.energie / AVERAGE_WEEKLY_FOOD_KG,
      portion_kg: basis.portion_kg,
    };
  }
  const faktor = _saisondaten?.umwelt_faktoren?.[score.regelKey] || { co2: 1, land: 1, wasser: 1, energie: 1 };
  return {
    co2_kg: basis.co2_kg * faktor.co2,
    land_m2: basis.land_m2 * faktor.land,
    wasser_l: basis.wasser_l * faktor.wasser,
    energie_mj: basis.energie_mj * faktor.energie,
    portion_kg: basis.portion_kg,
  };
}

// Rechnet einen Listenartikel in kg um: nutzt item.amount/item.unit (z. B. aus einem
// Rezept) wenn vorhanden, sonst die produkt-/kategorietypische Portionsgröße × qty.
// Bei stückbasierten/unbekannten Einheiten (Glas, Bund, Dose, …) wird aufgerundet: im Laden
// gibt es nur ganze Einheiten zu kaufen — "ein halbes Glas" im Rezept bedeutet in der Praxis,
// dass ein ganzes Glas gekauft (und damit auch dessen Fußabdruck fällig) wird.
function _itemToKg(item, footprint) {
  const qty = item.qty || 1;
  if (item.amount != null) {
    const unit = (item.unit || '').toLowerCase().trim();
    const factor = _UNIT_TO_KG[unit];
    if (factor != null) return item.amount * factor * qty;
    const smallUnitKg = _SMALL_UNIT_KG[unit] || _smallUnitKgFromText(item.text);
    if (smallUnitKg != null) return smallUnitKg * item.amount * qty;
    const units = Math.max(1, Math.ceil(item.amount));
    return footprint.portion_kg * units * qty;
  }
  return footprint.portion_kg * qty;
}

// Gewicht eines Artikels schätzen, für den es KEINE Fußabdruck-Daten gibt (z. B. Nudeln,
// Mayonnaise, Essig, Gewürze — nicht in ernaehrung.json/saisondaten3.json enthalten).
// Ohne diese Schätzung würde das Gewicht solcher Artikel beim Einkauf komplett wegfallen,
// wodurch z. B. eine kleine Menge Käse in einem sonst unbekannten Nudelsalat wie der GESAMTE
// Einkauf aussähe (siehe _computeFootprintTotals).
function _itemToKgUnmatched(item) {
  const qty = item.qty || 1;
  if (item.amount != null) {
    const unit = (item.unit || '').toLowerCase().trim();
    const factor = _UNIT_TO_KG[unit];
    if (factor != null) return item.amount * factor * qty;
    const smallUnitKg = _SMALL_UNIT_KG[unit] || _smallUnitKgFromText(item.text);
    if (smallUnitKg != null) return smallUnitKg * item.amount * qty;
    return 0.1 * Math.max(1, Math.ceil(item.amount)) * qty; // grobe Annahme: 1 Stück ≈ 100g
  }
  return _NO_AMOUNT_DEFAULT_KG * qty;
}

// Fußabdruck + Gesamtgewicht eines abgeschlossenen Einkaufs berechnen (wird in die
// Einkaufs-Historie geschrieben, siehe finishShopping).
function _computeFootprintTotals(items) {
  const totals = { co2: 0, land: 0, wasser: 0, energie: 0, kg: 0 };
  for (const item of items) {
    const footprint = _getFootprintData(item.text);
    if (footprint) {
      const kg = _itemToKg(item, footprint);
      totals.co2     += kg * (footprint.co2_kg || 0);
      totals.land    += kg * (footprint.land_m2 || 0);
      totals.wasser  += kg * (footprint.wasser_l || 0);
      totals.energie += kg * (footprint.energie_mj || 0);
      totals.kg      += kg;
    } else {
      // Kein Match (Nudeln, Mayo, Gewürze, …): Gewicht zählt mit, aber mit dem
      // durchschnittlichen deutschen Fußabdruck pro kg bewertet (weder Bonus noch Malus) —
      // ehrlicher als es komplett zu ignorieren, ohne unbelegte Annahmen über das
      // konkrete Produkt zu treffen.
      const kg = _itemToKgUnmatched(item);
      totals.co2     += kg * (FOOTPRINT_BASELINE_WEEKLY.co2 / AVERAGE_WEEKLY_FOOD_KG);
      totals.land    += kg * (FOOTPRINT_BASELINE_WEEKLY.land / AVERAGE_WEEKLY_FOOD_KG);
      totals.wasser  += kg * (FOOTPRINT_BASELINE_WEEKLY.wasser / AVERAGE_WEEKLY_FOOD_KG);
      totals.energie += kg * (FOOTPRINT_BASELINE_WEEKLY.energie / AVERAGE_WEEKLY_FOOD_KG);
      totals.kg      += kg;
    }
  }
  return totals;
}

// Rollierendes 7-Tage-Fenster über die Einkaufs-Historie (gruenkorb-einkauf-history).
// Es wird die Fußabdruck-INTENSITÄT pro eingekauftem kg gemessen (nicht der Gesamtwert
// pro Zeit) — dadurch ist das Ergebnis unabhängig davon, wie viel oder wie oft eingekauft
// wird, und schon nach einem einzigen Einkauf aussagekräftig (misst Entscheidungsqualität,
// nicht Einkaufsmenge/-häufigkeit oder wann in der Woche mit dem Tracking begonnen wurde).
function _getRollingFootprint() {
  const history = JSON.parse(localStorage.getItem('gruenkorb-einkauf-history') || '[]');
  const now = Date.now();
  const windowMs = 7 * 86400000;
  const windowEntries = history.filter(h => h.footprint && (now - new Date(h.datum).getTime()) <= windowMs);
  if (!windowEntries.length) return null;

  const totals = windowEntries.reduce((acc, h) => {
    acc.co2     += h.footprint.co2 || 0;
    acc.land    += h.footprint.land || 0;
    acc.wasser  += h.footprint.wasser || 0;
    acc.energie += h.footprint.energie || 0;
    acc.kg      += h.footprint.kg || 0;
    return acc;
  }, { co2: 0, land: 0, wasser: 0, energie: 0, kg: 0 });

  return totals;
}

// Rechnet den recherchierten Referenz-Warenkorb (warenkorb.json: Pro-Kopf-Jahresmenge je
// Kategorie/Produkt) mit denselben Basiswerten durch, die auch für den Nutzer-Einkauf gelten
// (kategorie_umwelt für Obst/Gemüse, ernaehrung.json-umwelt für tierische Produkte) — auf
// Wochenbasis (/52), damit Nutzer- und Ø-Deutschland-Wert exakt vergleichbar sind (siehe
// _computeFootprintTotals). Referenzwerte gehen bewusst von der Basis "regional, Ernte,
// Freiland" aus (Multiplikator 1×), da keine belastbare Statistik existiert, wie sich der
// tatsächliche deutsche Import-/Saison-Mix über alle Kategorien verteilt.
function _computeReferenceWeeklyTotals() {
  const totals = { co2: 0, land: 0, wasser: 0, energie: 0 };
  if (!_warenkorb || !_saisondaten) return totals;
  for (const [kategorie, ref] of Object.entries(_warenkorb.gemuese_obst_kategorien || {})) {
    const basis = _saisondaten.kategorie_umwelt?.[kategorie];
    if (!basis) continue;
    const kgWoche = ref.kg_pro_kopf_jahr / 52;
    totals.co2     += kgWoche * basis.co2_kg;
    totals.land    += kgWoche * basis.land_m2;
    totals.wasser  += kgWoche * basis.wasser_l;
    totals.energie += kgWoche * basis.energie_mj;
  }
  for (const [id, ref] of Object.entries(_warenkorb.tierische_produkte || {})) {
    const basis = _getErnProduktById(id)?.umwelt;
    if (!basis) continue;
    const kgWoche = ref.kg_pro_kopf_jahr / 52;
    totals.co2     += kgWoche * basis.co2_kg;
    totals.land    += kgWoche * basis.land_m2;
    totals.wasser  += kgWoche * basis.wasser_l;
    totals.energie += kgWoche * basis.energie_mj;
  }
  return totals;
}

function renderFoodProfileCard() {
  const totals = _getRollingFootprint();
  // Ohne nennenswertes Einkaufsgewicht (z. B. nur nicht erkannte Artikel) wäre der
  // Vergleich nicht aussagekräftig.
  const hasEnoughData = totals && totals.kg >= 0.1;

  // Absoluter Vergleich über denselben Zeitraum (rollierende Woche) statt Intensität pro kg:
  // (Ø-Deutschland − Nutzer) / Ø-Deutschland × 100, exakt wie vorgegeben. Wer weniger
  // einkauft, schneidet dadurch bewusst auch besser ab — nicht nur wer "klüger" einkauft.
  // "Besser als Durchschnitt" ist auf 100% begrenzt (Fußabdruck 0), "schlechter" kann real
  // das Mehrfache übersteigen (z. B. bei einem hohen Käse- oder Fleischanteil) — ungedeckelt,
  // damit unterschiedlich extreme Werte nicht optisch gleich aussehen.
  const pct = (value, baseline) => Math.round((baseline - value) / baseline * 100);
  const referenz = _computeReferenceWeeklyTotals();
  const pctMetrics = hasEnoughData ? {
    co2:     pct(totals.co2, referenz.co2),
    land:    pct(totals.land, referenz.land),
    wasser:  pct(totals.wasser, referenz.wasser),
    energie: pct(totals.energie, referenz.energie),
  } : null;

  // Kacheln zeigen den absoluten Wochenwert (nicht die Prozent-Differenz) — Einordnung
  // besser/schlechter als Ø Deutschland bleibt über die Farbe (--bad) erhalten.
  const fmt = (value, decimals) => value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const setCell = (id, value, unit, decimals, betterThanAvg) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (value == null) { el.textContent = '–'; el.classList.remove('profil-metric-cell-val--bad'); return; }
    el.textContent = `${fmt(value, decimals)} ${unit}`;
    el.classList.toggle('profil-metric-cell-val--bad', betterThanAvg === false);
  };
  setCell('profil-metric-co2',     hasEnoughData ? totals.co2     : null, 'kg', 1, pctMetrics && pctMetrics.co2 >= 0);
  setCell('profil-metric-land',    hasEnoughData ? totals.land    : null, 'm²', 1, pctMetrics && pctMetrics.land >= 0);
  setCell('profil-metric-wasser',  hasEnoughData ? totals.wasser  : null, 'l',  0, pctMetrics && pctMetrics.wasser >= 0);
  setCell('profil-metric-energie', hasEnoughData ? totals.energie : null, 'MJ', 0, pctMetrics && pctMetrics.energie >= 0);

  const ring = document.getElementById('profil-ring-fill');
  const ringPct = document.getElementById('profil-ring-pct-text');
  if (pctMetrics) {
    const avg = Math.round((pctMetrics.co2 + pctMetrics.land + pctMetrics.wasser + pctMetrics.energie) / 4);
    const clamped = Math.max(0, Math.min(100, avg));
    if (ring) {
      const circumference = 301.6;
      ring.style.strokeDashoffset = String(circumference * (1 - clamped / 100));
    }
    if (ringPct) ringPct.textContent = `${avg}%`;
  } else {
    if (ring) ring.style.strokeDashoffset = '301.6';
    if (ringPct) ringPct.textContent = '–';
  }
}

/* ══════════════════════════════════════════
   EINKAUF ABSCHLIESSEN
   ══════════════════════════════════════════ */

function showShoppingDoneDialog() {
  if (!listItems.length) return;
  const overlay = document.createElement('div');
  overlay.className = 'shopping-done-overlay';
  overlay.id = 'shopping-done-overlay';
  overlay.innerHTML = `
    <div class="shopping-done-sheet">
      <div class="shopping-done-icon">🛍️</div>
      <h2 class="shopping-done-title">Alles eingekauft?</h2>
      <p class="shopping-done-sub">Deine ${listItems.length} Artikel werden für deinen Öko-Score gewertet.</p>
      <button class="shopping-done-yes" onclick="finishShopping(true)">
        Ja, alles eingekauft
      </button>
      <button class="shopping-done-no" onclick="closeShoppingDoneDialog()">
        Nein, zurück zur Liste
      </button>
      <button class="shopping-done-delete" onclick="finishShopping(false)">
        Nein, trotzdem löschen
      </button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeShoppingDoneDialog(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeShoppingDoneDialog() {
  const overlay = document.getElementById('shopping-done-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function finishShopping(scoreIt) {
  if (scoreIt) {
    // Nur noch nicht per toggleDone gewertete Swaps zählen
    const unscored = listItems.filter(i => i.ecoSwap && !i.ecoSwapScored);
    const swapCount = unscored.length;

    const score = JSON.parse(localStorage.getItem('gruenkorb-score') || '{"total":0,"swaps":0,"purchases":0}');
    score.purchases += 1;
    score.swaps     += swapCount;
    score.total     += swapCount;
    localStorage.setItem('gruenkorb-score', JSON.stringify(score));

    const history = JSON.parse(localStorage.getItem('gruenkorb-einkauf-history') || '[]');
    history.push({
      datum: new Date().toISOString(),
      punkte: swapCount,
      footprint: _computeFootprintTotals(listItems),
      items: listItems.map(i => ({
        text: i.text, produktId: i.produktId || null,
        ampel: i.ampel || null, ecoSwap: i.ecoSwap || null,
      }))
    });
    localStorage.setItem('gruenkorb-einkauf-history', JSON.stringify(history));

    // Challenge-Tracking
    updateChallengeProgress('purchases-10', 1);

    const seasonalCount = listItems.filter(i => i.ampel === 'gruen').length;
    if (seasonalCount) updateChallengeProgress('regional-seasonal', seasonalCount);

    const meatIds = ['haehnchen','rind','schwein','lamm','lachs','thunfisch','garnelen'];
    const hasMeat = listItems.some(i => meatIds.includes(i.ecoSwap?.fromErnId) || meatIds.some(mid => _matchErnaehrung(i.text)?.id === mid));
    if (!hasMeat) updateChallengeProgress('veggie-week', 1);

    if (swapCount) updateChallengeProgress('eco-swaps', swapCount);

    // Punkte, Serie & Abzeichen für den Einkauf (features.js)
    if (typeof gmOnPurchase === 'function') gmOnPurchase(listItems);

    const totalSwaps = listItems.filter(i => i.ecoSwap).length;
    const msg = totalSwaps > 0
      ? `🛍️ Einkauf gespeichert! ${swapCount > 0 ? `+${swapCount} weiterer Punkt${swapCount > 1 ? 'e' : ''}` : 'Punkte bereits vergeben'}`
      : '🛍️ Einkauf abgeschlossen!';
    _showToast(msg);
  }

  // Alles löschen
  listItems = [];
  saveList();
  closeShoppingDoneDialog();
  renderList();
}

/* ══════════════════════════════════════════
   RECIPE IMPORT
   ══════════════════════════════════════════ */

function _fmtAmount(n) {
  if (n == null) return '';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1).replace('.', ',');
}

let _recipeModal = null;
let _recipeIngredients = []; // [{name, amount, unit, checked}]

// preset: optionales Rezept-Objekt {title, servings, ingredients: [{name, amount, unit}]}
// aus einem Vorschlag auf der Startseite — überspringt die URL-Eingabe und zeigt die
// Zutaten direkt an, wie nach dem Laden eines importierten Rezepts.
function showRecipeImport(preset) {
  if (_recipeModal) return;

  _recipeIngredients = [];

  const overlay = document.createElement('div');
  overlay.className = 'recipe-overlay';
  overlay.id = 'recipe-modal-overlay';
  overlay.innerHTML = `
    <div class="recipe-sheet">
      <div class="recipe-sheet-handle"></div>
      <div class="recipe-sheet-head">
        <h2>${preset ? 'Zutaten hinzufügen' : 'Rezept importieren'}</h2>
        <p>${preset ? 'Wähle aus, was du brauchst' : 'Füge den Link eines Rezepts ein'}</p>
      </div>
      ${preset ? '' : `
      <div class="recipe-url-row">
        <input id="recipe-url-input" class="recipe-url-input" type="url"
          placeholder="https://www.chefkoch.de/rezepte/…"
          onkeydown="if(event.key==='Enter') _fetchRecipe()" />
        <button id="recipe-fetch-btn" class="recipe-fetch-btn" onclick="_fetchRecipe()">Laden</button>
      </div>`}
      <div class="recipe-sheet-body" id="recipe-sheet-body"></div>
      <div class="recipe-sheet-footer" id="recipe-sheet-footer" style="display:none">
        <button class="recipe-cancel-btn" onclick="closeRecipeModal()">Abbrechen</button>
        <button class="recipe-add-all-btn" id="recipe-add-btn" onclick="_addRecipeToList()">Hinzufügen</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeRecipeModal(); });
  document.body.appendChild(overlay);
  _recipeModal = overlay;

  if (preset) {
    _renderRecipeResults({ ...preset, _preset: true });
    return;
  }

  requestAnimationFrame(() => {
    const inp = document.getElementById('recipe-url-input');
    if (inp) { inp.focus(); inp.select(); }
  });
}

function addOfentomatenRezept() {
  showRecipeImport({
    title: 'Ofentomaten mit Linsen',
    servings: '4',
    ingredients: [
      { name: 'Rispentomaten', amount: 800, unit: 'g' },
      { name: 'Rote Linsen', amount: 250, unit: 'g' },
      { name: 'Zwiebel', amount: 1, unit: 'Stück' },
      { name: 'Knoblauch', amount: 2, unit: 'Zehen' },
      { name: 'Gemüsebrühe', amount: 500, unit: 'ml' },
      { name: 'Olivenöl', amount: 3, unit: 'EL' },
      { name: 'Thymian', amount: 1, unit: 'Bund' },
    ],
  });
}

function closeRecipeModal() {
  if (_recipeModal) { _recipeModal.remove(); _recipeModal = null; }
  _recipeIngredients = [];
}

async function _fetchRecipe() {
  const input = document.getElementById('recipe-url-input');
  const url = (input?.value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    _showRecipeBody(`<div class="recipe-error">Bitte eine gültige URL eingeben (beginnend mit https://…)</div>`);
    return;
  }

  const btn = document.getElementById('recipe-fetch-btn');
  if (btn) btn.disabled = true;
  _showRecipeBody(`<div class="recipe-loading"><div class="recipe-loading-spinner"></div>Rezept wird geladen…</div>`);
  document.getElementById('recipe-sheet-footer').style.display = 'none';

  // 1. Try local backend (if running)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`http://localhost:3456/api/recipe?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok) {
      _showRecipeBody(`<div class="recipe-error">${escapeHtml(data.error || 'Unbekannter Fehler')}</div>`);
      if (btn) btn.disabled = false;
      return;
    }
    _renderRecipeResults(data);
    return;
  } catch(_) { /* backend not running, fall through */ }

  // 2. Browser-side parse via public CORS proxy
  try {
    await _fetchRecipeDirect(url);
  } catch(e) {
    _showRecipeBody(`<div class="recipe-error">${escapeHtml(e.message || 'Rezept konnte nicht geladen werden.')}</div>`);
    if (btn) btn.disabled = false;
  }
}

async function _fetchRecipeDirect(url) {
  const btn = document.getElementById('recipe-fetch-btn');
  // Try multiple CORS proxies
  const proxies = [
    { url: `https://corsproxy.io/?url=${encodeURIComponent(url)}`, raw: true },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, raw: false },
    { url: `https://corsproxy.io/?url=${encodeURIComponent(url)}&nocache=${Date.now()}`, raw: true },
  ];
  let html = null;
  for (const proxy of proxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(proxy.url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      if (proxy.raw) {
        html = await res.text();
      } else {
        const json = await res.json();
        html = json?.contents || null;
      }
      if (html && html.length > 200) break;
      html = null;
    } catch(_) {}
  }
  if (!html) throw new Error('Seite konnte nicht geladen werden. Prüfe deine Internetverbindung oder probiere eine andere Rezept-URL.');

  const recipe = _parseRecipeHtml(html);
  if (!recipe) throw new Error('Kein Rezept auf dieser Seite gefunden. Unterstützte Seiten: Chefkoch, Lecker, REWE Rezepte, AllRecipes u. v. m.');

  const title = recipe.name || 'Rezept';
  const servings = typeof recipe.recipeYield === 'string' ? recipe.recipeYield
    : Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : null;
  const ingredients = (recipe.recipeIngredient || []).map(_parseIngredientBrowser);
  _renderRecipeResults({ title, servings, ingredients });
  if (btn) btn.disabled = false;
}

function _parseRecipeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const recipe = _findRecipeNode(JSON.parse(script.textContent || ''));
      if (recipe?.recipeIngredient) return recipe;
    } catch(_) {}
  }
  return null;
}

function _findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = _findRecipeNode(n); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  if (node['@graph']) return _findRecipeNode(node['@graph']);
  return null;
}

const _UNIT_PAT_BR = 'kg|g|mg|l|ml|cl|dl|EL|TL|Tassen?|Becher|Pck\\.?|Packungen?|Bund(?:el)?|Zehen?|Scheiben?|Dosen?|Gläser?|Glas|Prisen?|Msp\\.?|Messerspitzen?|Tropfen|Zweige?|Blätter|Blatt|Handvoll|Stück|Stk\\.?|Knollen?|Köpfe?|Kopf';
const _ING_RE_BR = new RegExp(`^(\\d+[\\.,]\\d+|\\d+\\/\\d+|\\d+)\\s*(?:(${_UNIT_PAT_BR})\\.?\\s+)?(.+)$`, 'i');
const _FRAC_BR = {'½':'0.5 ','⅓':'0.3333 ','⅔':'0.6667 ','¼':'0.25 ','¾':'0.75 ','⅛':'0.125 ','⅜':'0.375 ','⅝':'0.625 ','⅞':'0.875 '};

function _parseIngredientBrowser(raw) {
  if (!raw) return { raw, amount: null, unit: null, name: '' };
  let s = raw.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, c => _FRAC_BR[c] || '')
             .replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#?\w+;/g,' ')
             .replace(/\s+/g,' ').trim();
  const m = s.match(_ING_RE_BR);
  if (m) {
    const a = m[1].replace(',','.');
    const amount = a.includes('/') ? (() => { const [p,q]=a.split('/'); return parseFloat(p)/parseFloat(q); })() : parseFloat(a);
    const name = (m[3] || '').replace(/\([^)]*\)/g,'').replace(/,\s*\S+.*$/,'').replace(/^(?:etwas|einige?|ein paar|nach Geschmack|n\.G\.?)\s+/i,'').replace(/\s+/g,' ').trim();
    return { raw, amount, unit: m[2] || 'Stück', name };
  }
  const name = s.replace(/^(?:etwas|einige?|ein paar|nach Geschmack|n\.G\.?|zum Abschmecken)\s+/i,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
  return { raw, amount: null, unit: null, name };
}

function _showRecipeBody(html) {
  const body = document.getElementById('recipe-sheet-body');
  if (body) body.innerHTML = html;
}

function _renderRecipeResults(data) {
  _recipeIngredients = data.ingredients.map(ing => ({
    ...ing,
    checked: true,
  }));

  const servingsLabel = data.servings ? `<span class="recipe-servings">${data.servings} Portionen</span>` : '';

  const itemsHtml = _recipeIngredients.map((ing, i) => {
    const produkt = _matchSaisondatenByName(ing.name);
    let score = null;
    if (produkt && _saisondaten) score = _calculateSaisonScore(produkt, []);
    let badgeHtml = '';
    if (score) {
      const cls = { gruen: 'recipe-ing-badge-gruen', gelb: 'recipe-ing-badge-gelb', rot: 'recipe-ing-badge-rot' }[score.ampel] || 'recipe-ing-badge-none';
      const label = { gruen: 'In Saison', gelb: 'Bedingt', rot: 'Außer Saison' }[score.ampel] || '';
      badgeHtml = `<span class="recipe-ing-badge ${cls}">${label}</span>`;
    }
    const amountStr = ing.amount != null ? `${_fmtAmount(ing.amount)} ${ing.unit || ''}`.trim() : '';
    return `
      <li class="recipe-ing-item" onclick="_toggleRecipeIng(${i})">
        <div class="recipe-ing-check checked" id="recipe-chk-${i}"></div>
        <div class="recipe-ing-text">
          <div class="recipe-ing-name">${escapeHtml(ing.name)}</div>
          ${amountStr ? `<div class="recipe-ing-amount">${escapeHtml(amountStr)}</div>` : ''}
        </div>
        ${badgeHtml}
      </li>`;
  }).join('');

  // Per Link importierte Rezepte lassen sich ins Kochbuch übernehmen (features.js)
  const saveBtn = !data._preset && typeof kbImportSaveButtonHtml === 'function' ? kbImportSaveButtonHtml(data) : '';
  _showRecipeBody(`
    <div class="recipe-result-title">${escapeHtml(data.title)}${servingsLabel}</div>
    ${saveBtn}
    <ul class="recipe-ing-list">${itemsHtml}</ul>
  `);
  document.getElementById('recipe-sheet-footer').style.display = 'flex';
  _updateAddBtn();

  const btn = document.getElementById('recipe-fetch-btn');
  if (btn) btn.disabled = false;
}

function _toggleRecipeIng(i) {
  if (!_recipeIngredients[i]) return;
  _recipeIngredients[i].checked = !_recipeIngredients[i].checked;
  const chk = document.getElementById(`recipe-chk-${i}`);
  if (chk) chk.className = `recipe-ing-check ${_recipeIngredients[i].checked ? 'checked' : ''}`;
  _updateAddBtn();
}

function _updateAddBtn() {
  const btn = document.getElementById('recipe-add-btn');
  if (!btn) return;
  const count = _recipeIngredients.filter(i => i.checked).length;
  btn.disabled = count === 0;
  btn.textContent = count === _recipeIngredients.length
    ? 'Alle hinzufügen'
    : `${count} hinzufügen`;
}

function _addRecipeToList() {
  const toAdd = _recipeIngredients.filter(i => i.checked);
  for (const ing of toAdd) {
    const name = ing.name;
    if (!name) continue;
    let ampel = null, saisonText = null, produktId = null;
    const produkt = _matchSaisondatenByName(name);
    if (produkt && _saisondaten) {
      const score = _calculateSaisonScore(produkt, []);
      if (score) { ampel = score.ampel; saisonText = score.text; }
      produktId = produkt.id;
    }
    const newItem = {
      text: name,
      ampel, saisonText, produktId,
      done: false,
      id: Date.now() + Math.random(),
      qty: 1,
      amount: ing.amount,
      unit: ing.unit || null,
      fromRecipe: true,
    };
    listItems.push(newItem);
  }
  saveList();
  if (toAdd.length > 0) updateChallengeProgress('recipes-5', 1);
  closeRecipeModal();
  // Aus einem geöffneten Rezept-Fenster heraus: Rezept offen lassen, nur kurz bestätigen
  if (typeof _kbOvIsOpen === 'function' && _kbOvIsOpen()) {
    _showToast(`🛒 ${toAdd.length} ${toAdd.length === 1 ? 'Zutat' : 'Zutaten'} auf der Einkaufsliste`);
    if (activeTab === 'list') renderList();
    return;
  }
  showScreen('list');
  renderList();
}

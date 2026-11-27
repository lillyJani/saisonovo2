#!/usr/bin/env python3
"""Saisonovo – Rezepte aus dem deutschen Wikibooks-Kochbuch (CC BY-SA 4.0) importieren.

Aufruf (im App-Ordner):
    python3 tools/wikibooks-kochbuch/import.py

1. lädt alle Seiten der Kategorie „Kochbuch/ Alle Rezepte“ über die Wikibooks-API (→ tools/wikibooks-kochbuch/raw.json)
   – mit --offline wird eine vorhandene raw.json verwendet
2. zerlegt sie in Titel, Beschreibung, Zutaten (Menge, Einheit, Name, Hinweis), Schritte, Zeit, Portionen, Tags, Typ
3. sortiert unbrauchbare Seiten aus (Getränke, Soßen, Grundrezepte, Seiten ohne Zutaten/Zubereitung)
4. schreibt rezepte-wikibooks.json in den App-Ordner (mit Quelle, Versionsgeschichte und Lizenz je Rezept)
   und einen Bericht nach tools/wikibooks-kochbuch/bericht.json
Nur Python 3 – keine zusätzlichen Pakete.
"""
import json, re, sys, html, os, time, urllib.request, urllib.parse
from fractions import Fraction

HIER = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HIER, 'raw.json')
OUT = os.path.join(HIER, '..', '..', 'rezepte-wikibooks.json')
REPORT = os.path.join(HIER, 'bericht.json')
API = 'https://de.wikibooks.org/w/api.php'
UA = 'Saisonovo-Rezeptimport/1.0 (https://lillyjani.github.io/saisonovo/)'


def lade_seiten():
    """Alle Rezeptseiten samt Wikitext über die MediaWiki-API holen (50 Seiten pro Anfrage)."""
    out, cont = [], {}
    while True:
        q = {'action': 'query', 'format': 'json', 'formatversion': '2', 'generator': 'categorymembers',
             'gcmtitle': 'Kategorie:Kochbuch/ Alle Rezepte', 'gcmlimit': '50', 'gcmnamespace': '0',
             'prop': 'revisions', 'rvprop': 'content|ids|timestamp', 'rvslots': 'main', **cont}
        req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=60) as res:
            d = json.load(res)
        for p in d.get('query', {}).get('pages', []):
            r = (p.get('revisions') or [None])[0]
            if r:
                out.append({'t': p['title'], 'id': p['pageid'], 'rev': r['revid'], 'ts': r['timestamp'],
                            'x': r['slots']['main']['content']})
        if 'continue' not in d:
            return out
        cont = d['continue']
        time.sleep(0.5)

AUSSCHLUSS_KAT = {
    'Getränke', 'Alkoholfreies Getränk', 'Alkoholische Getränke', 'Bowle', 'Tee', 'Cocktails', 'Likör', 'Liköre',
    'Saucen', 'Grundrezepte', 'Füllungen', 'Gewürzmischungen', 'Techniken', 'Alkoholische Zutaten',
}
TYP_KAT = [
    ('suppe', {'Suppen und Eintöpfe', 'Suppen', 'Eintöpfe'}),
    ('salat', {'Salatrezepte', 'Salat', 'Salate'}),
    ('dessert', {'Desserts', 'Gebäck und Kuchen', 'Gebäck', 'Weihnachtsgebäck', 'Torten', 'Eis', 'Pudding',
                 'Süßigkeiten', 'Kuchen', 'Backen', 'Kekse', 'Plätzchen', 'Süßspeisen'}),
    ('fruehstueck', {'Frühstück', 'Brot und Brötchen', 'Brotaufstriche', 'Aufstriche', 'Snacks', 'Müsli'}),
]
EMOJI = {'hauptgericht': '🍽️', 'suppe': '🍲', 'salat': '🥗', 'fruehstueck': '🥣', 'dessert': '🍰'}

ZAHLWORT = {'ein': 1, 'eine': 1, 'einen': 1, 'einem': 1, 'einer': 1, 'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4,
            'fünf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10, 'zwölf': 12, 'halbe': 0.5,
            'halben': 0.5, 'halber': 0.5, 'halbes': 0.5, 'einhalb': 0.5}
BRUCH = {'½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125}

# Einheiten: Schreibweise im Text → Einheit in der App
EINHEITEN = [
    (r'kilogramm|kilo|kg', 'kg'), (r'gramm|gr\.?|g', 'g'), (r'milligramm|mg', 'mg'),
    (r'milliliter|ml', 'ml'), (r'zentiliter|cl', 'cl'), (r'deziliter|dl', 'dl'), (r'liter|ltr\.?|l', 'l'),
    (r'esslöffel|eßlöffel|el\.?', 'EL'), (r'teelöffel|tl\.?', 'TL'),
    (r'prisen?', 'Prise'), (r'messerspitzen?|msp\.?', 'Msp.'),
    (r'bund|bunde', 'Bund'), (r'zehen?', 'Zehe'), (r'stücke?|stk\.?|st\.', 'Stück'),
    (r'päckchen|pck\.?|pkg\.?|packungen?|pack', 'Päckchen'), (r'dosen?', 'Dose'), (r'becher', 'Becher'),
    (r'tassen?', 'Tasse'), (r'gläser|glas', 'Glas'), (r'scheiben?', 'Scheibe'), (r'stangen?', 'Stange'),
    (r'zweige?', 'Zweig'), (r'blätter|blatt', 'Blatt'), (r'handvoll|hand voll', 'Handvoll'),
    (r'knollen?', 'Knolle'), (r'köpfe|kopf', 'Kopf'), (r'würfel', 'Würfel'), (r'tropfen', 'Tropfen'),
    (r'schuss|spritzer', 'Schuss'), (r'dutzend', 'Dutzend'), (r'beutel', 'Beutel'), (r'tüten?', 'Tüte'),
]
EINHEIT_RE = re.compile(r'^(' + '|'.join(e for e, _ in EINHEITEN) + r')(?=[\s,.;:)–-]|$)', re.I)

ZAHL = r'(?:\d+\s+\d+/\d+|\d+\s*[½¼¾⅓⅔⅛]|\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?|[½¼¾⅓⅔⅛])'
MENGE_RE = re.compile(r'^(?:ca\.?|etwa|circa|jeweils|je|à|gut|knapp|insgesamt)?\s*(' + ZAHL + r')(?:\s*(?:-|–|bis)\s*(' + ZAHL + r'))?\s*', re.I)


def zahl(s):
    s = s.strip()
    gm = re.match(r'^(\d+)\s+(\d+)/(\d+)$', s)
    if gm:
        return int(gm.group(1)) + int(gm.group(2)) / int(gm.group(3))
    s = s.replace(' ', '')
    m = re.match(r'^(\d+)([½¼¾⅓⅔⅛])$', s)
    if m:
        return int(m.group(1)) + BRUCH[m.group(2)]
    if s in BRUCH:
        return BRUCH[s]
    if '/' in s:
        try:
            return float(Fraction(s.replace(',', '.')))
        except (ValueError, ZeroDivisionError):
            return None
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


def rund(x):
    if x is None:
        return None
    return int(x) if abs(x - round(x)) < 1e-9 else round(x, 2)


# ───────────── Wikitext bereinigen ─────────────
def entferne_vorlagen(t):
    # verschachtelte {{…}} entfernen
    for _ in range(6):
        n = re.sub(r'\{\{[^{}]*\}\}', '', t)
        if n == t:
            break
        t = n
    return t


def sauber(t):
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'<ref[^>]*/>', '', t)
    t = re.sub(r'<ref[^>]*>.*?</ref>', '', t, flags=re.S)
    t = re.sub(r'\{\{\s*(?:w|W|wikipedia|Wikipedia)\s*\|([^|}]*)(?:\|([^}]*))?\}\}', lambda m: (m.group(2) or m.group(1)), t)
    t = entferne_vorlagen(t)
    t = re.sub(r'\[\[(?:Datei|Bild|Image|File|Kategorie|Category):[^\]]*\]\]', '', t, flags=re.I)
    t = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', t)
    t = re.sub(r'\[\[([^\]]*)\]\]', lambda m: m.group(1).split('/')[-1].strip(), t)
    t = re.sub(r'\[https?://\S+\s+([^\]]*)\]', r'\1', t)
    t = re.sub(r'\[https?://[^\]]*\]', '', t)
    t = re.sub(r"'{2,}", '', t)
    t = re.sub(r'<gallery[^>]*>.*?</gallery>', '', t, flags=re.S | re.I)
    t = re.sub(r'</?(?:small|big|span|div|u|s|sup|sub|nowiki|b|i|center|font|noinclude|includeonly|onlyinclude|poem|blockquote|p|code|tt|strong|em)\b[^>]*>', '', t, flags=re.I)
    t = re.sub(r'<[^>]{1,40}>', '', t)
    t = re.sub(r'<br\s*/?>', ' ', t, flags=re.I)
    t = html.unescape(t)
    t = t.replace(' ', ' ')
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def kategorien(x):
    return [c.strip() for c in re.findall(r'\[\[Kategorie:Kochbuch/\s*([^|\]]+)', x)]


def rezeptbox(x):
    m = re.search(r'\{\{:Kochbuch/[ _]Vorlage/[ _]RezeptBox(.*?)\n\s*\}\}', x, re.S)
    if not m:
        return {}
    out = {}
    for k, v in re.findall(r'^\s*\|\s*([^=\n]+?)\s*=\s*(.*)$', m.group(1), re.M):
        v = re.sub(r'<!--.*?-->', '', v).strip()
        if v:
            out[k.strip()] = v
    return out


# ───────────── Abschnitte ─────────────
def abschnitte(x):
    """[(ebene, überschrift, [zeilen])] – Text vor der ersten Überschrift hat ebene 0."""
    out = [(0, '', [])]
    for line in x.split('\n'):
        m = re.match(r'^(={2,6})\s*(.*?)\s*\1\s*$', line)
        if m:
            out.append((len(m.group(1)), sauber(m.group(2)), []))
        else:
            out[-1][2].append(line)
    return out


def ist_zutaten(h):
    h = h.lower()
    return h.startswith('zutat') or h in ('benötigt', 'man braucht', 'einkaufsliste')


def ist_zubereitung(h):
    h = h.lower()
    return h.startswith('zubereitung') or h in ('rezept', 'anleitung', 'herstellung', 'arbeitsschritte', 'so geht’s', "so geht's")


NICHT_ZUTAT_HEADINGS = ('tipp', 'anmerk', 'variant', 'variation', 'hinweis', 'warnung', 'weblink', 'quelle', 'siehe',
                       'kochgeschirr', 'utensil', 'abkürz', 'vorbemerk', 'servier', 'beilage', 'nährwert', 'literatur')


def gruppiere(secs):
    """Ordnet Unterabschnitte (=== Teig ===) dem übergeordneten Abschnitt zu."""
    bloecke = []  # (art, untertitel, zeilen)
    art = None
    for ebene, h, zeilen in secs:
        hl = h.lower()
        if ebene == 0:
            bloecke.append(('intro', '', zeilen)); continue
        if ist_zutaten(h):
            art = 'zutaten'; bloecke.append((art, '', zeilen)); continue
        if ist_zubereitung(h):
            art = 'zubereitung'; bloecke.append((art, '', zeilen)); continue
        if any(hl.startswith(n) or n in hl for n in NICHT_ZUTAT_HEADINGS):
            art = 'sonst'; bloecke.append((art, h, zeilen)); continue
        # Unterüberschrift (Teig, Belag, Füllung …) gehört zum laufenden Block
        if ebene >= 3 and art in ('zutaten', 'zubereitung'):
            bloecke.append((art, h, zeilen)); continue
        bloecke.append(('sonst', h, zeilen)); art = 'sonst'
    return bloecke


# ───────────── Zutaten ─────────────
ETWAS_RE = re.compile(r'^(?:etwas|einige|ein paar|wenig|reichlich|nach (?:Geschmack|Belieben|Bedarf)|evtl\.?|eventuell|optional|n\.\s*B\.)\s+', re.I)


def parse_zutat(roh, gruppe=None):
    t = sauber(roh)
    t = re.sub(r'^[-–•·]\s*', '', t).strip()
    if not t or len(t) > 160:
        return None
    hinweise = []
    if gruppe:
        hinweise.append(f'für {gruppe}' if not gruppe.lower().startswith('für') else gruppe)

    # Hinweis in Klammern / nach Komma abtrennen
    def abtrennen(name):
        extra = []
        for m in re.findall(r'\(([^()]*)\)', name):
            extra.append(m.strip())
        name = re.sub(r'\s*\([^()]*\)', '', name).strip()
        if ',' in name:
            a, b = name.split(',', 1)
            if a.strip():
                name, extra = a.strip(), extra + [b.strip()]
        return name, [e for e in extra if e]

    menge = None
    einheit = None
    rest = t
    m = ETWAS_RE.match(rest)
    if m:
        hinweise.append(m.group(0).strip().rstrip('.').lower() if m.group(0).lower().startswith(('nach', 'optional', 'evtl', 'eventuell', 'n.')) else m.group(0).strip().lower())
        rest = rest[m.end():]
    m = MENGE_RE.match(rest)
    if m:
        a, b = zahl(m.group(1)), (zahl(m.group(2)) if m.group(2) else None)
        if a is not None:
            menge = b if b else a
            if b:
                hinweise.append(f'{m.group(1).strip()}–{m.group(2).strip()}')
            rest = rest[m.end():]
    else:
        w = re.match(r'^(\w+)\s+', rest)
        if w and w.group(1).lower() in ZAHLWORT:
            nxt = rest[w.end():]
            # „eine Prise Salz“, „zwei Eier“ – aber nicht „ein wenig“
            if not re.match(r'^(wenig|paar|bisschen|klein)', nxt, re.I):
                menge = ZAHLWORT[w.group(1).lower()]
                rest = nxt
    if menge is not None:
        rest = re.sub(r'^(?:große?n?|kleine?n?|mittelgroße?n?|gehäufte?n?|gestrichene?n?|knappe?n?|gute?n?)\s+(?=\S)', lambda mm: (hinweise.append(mm.group(0).strip()) or ''), rest, flags=re.I)
        u = EINHEIT_RE.match(rest)
        if u:
            for muster, norm in EINHEITEN:
                if re.fullmatch(muster, u.group(1), re.I):
                    einheit = norm; break
            rest = rest[u.end():].lstrip(' .')
            # „500 g–1 kg Rindfleisch“: zweite Angabe der Spanne überspringen
            sp = re.match(r'^(?:-|–|bis)\s*(' + ZAHL + r')\s*(\S+)\s+', rest)
            if sp and EINHEIT_RE.match(sp.group(2)):
                hinweise.append(f'{rund(menge)} {einheit}–{sp.group(1)} {sp.group(2)}')
                rest = rest[sp.end():]
        rest = re.sub(r'^(?:à|a)\s+\d+\s*\w*\s+', '', rest)
    else:
        # „Kartoffeln 500g (…)“ – Menge hinten
        m2 = re.match(r'^(.*?)\s+(' + ZAHL + r')\s*([A-Za-zäöüÄÖÜ.]+)?\s*(\(.*\))?$', rest)
        if m2 and m2.group(1) and (m2.group(3) is None or EINHEIT_RE.match(m2.group(3) or '')):
            menge = zahl(m2.group(2))
            if m2.group(3):
                u = EINHEIT_RE.match(m2.group(3))
                for muster, norm in EINHEITEN:
                    if re.fullmatch(muster, u.group(1), re.I):
                        einheit = norm; break
            rest = m2.group(1) + (' ' + m2.group(4) if m2.group(4) else '')
    rest = rest.strip(' :;-–')
    name, extra = abtrennen(rest)
    name = re.sub(r'^(?:von|vom)\s+', '', name).strip()
    name = re.sub(r'\s+(?:nach Geschmack|nach Belieben|nach Bedarf)$', lambda mm: (hinweise.append(mm.group(0).strip()) or ''), name, flags=re.I)
    if not name or len(name) > 70 or not re.search(r'[A-Za-zÄÖÜäöüß]', name):
        return None
    if einheit == 'Stück':
        einheit = 'Stück'
    if menge is not None and menge <= 0:
        menge = None
    if menge is None:
        einheit = None
    z = {'name': name[0].upper() + name[1:], 'menge': rund(menge), 'einheit': einheit}
    h = ', '.join(dict.fromkeys([*hinweise, *extra]))
    if h:
        z['hinweis'] = h[:120]
    return z


def zutaten_aus(bloecke):
    out = []
    for art, gruppe, zeilen in bloecke:
        if art != 'zutaten':
            continue
        sub = None
        for line in zeilen:
            s = line.rstrip()
            if re.match(r'^;\s*', s):                    # ; Teig  → Gruppenüberschrift
                sub = sauber(s[1:]).rstrip(':') or None
                continue
            m = re.match(r'^[*#]+(?![:*#])\s*(.+)$', s)
            if m:
                txt = m.group(1)
                # „Salz und Pfeffer“ bleibt eine Zeile; Aufzählungen „Salz, Pfeffer, Muskat“ ohne Mengen splitten
                if not re.match(r'^\s*(?:' + ZAHL + r')', sauber(txt)) and ',' in sauber(txt) and len(sauber(txt)) < 60 and '(' not in txt:
                    teile = [p.strip() for p in sauber(txt).split(',') if p.strip()]
                    if 2 <= len(teile) <= 6 and all(len(p.split()) <= 3 and p[:1].isupper() for p in teile):
                        for p in teile:
                            z = parse_zutat(p, sub or gruppe or None)
                            if z: out.append(z)
                        continue
                z = parse_zutat(txt, sub or gruppe or None)
                if z:
                    out.append(z)
            elif re.match(r'^\s*\w', s) and sub is None and not out and False:
                pass
    return out


# ───────────── Schritte ─────────────
STOP_RE = re.compile(r'^(?:Erfasst von|Quelle|Siehe auch|Guten Appetit|Kategorie:)', re.I)


def schritte_aus(bloecke):
    out = []
    for art, gruppe, zeilen in bloecke:
        if art != 'zubereitung':
            continue
        prefix = f'{gruppe}: ' if gruppe else ''
        absatz = []

        def flush():
            if absatz:
                txt = sauber(' '.join(absatz))
                if txt and not STOP_RE.match(txt) and len(txt) > 3:
                    out.append(prefix + txt)
                absatz.clear()

        for line in zeilen:
            s = line.rstrip()
            if not s.strip():
                flush(); continue
            if s.lstrip().startswith(('{|', '|', '!', '[[Kategorie', '[[Datei', '[[Bild', '__')):
                flush(); continue
            m = re.match(r'^([*#]+)([:*#]?)\s*(.*)$', s)
            if m:
                if m.group(2) == ':' and out:                # Fortsetzung des vorigen Schritts
                    flush()
                    zusatz = sauber(m.group(3))
                    if zusatz:
                        out[-1] = out[-1] + ' ' + zusatz
                    continue
                flush()
                txt = sauber(m.group(3))
                if txt and not STOP_RE.match(txt):
                    out.append(prefix + txt)
                continue
            if s.startswith(':'):
                zusatz = sauber(s.lstrip(':'))
                if zusatz and out:
                    out[-1] += ' ' + zusatz
                continue
            if s.startswith(';'):
                flush()
                prefix = sauber(s[1:]).rstrip(':') + ': ' if sauber(s[1:]) else prefix
                continue
            absatz.append(s)
        flush()
    # Schritte säubern
    clean = []
    out = [s for s in out if not re.search(r'Datei:|File:|Bild:|\{\{|\}\}|\|', s)]
    for s in out:
        s = re.sub(r'\s+', ' ', s).strip()
        s = s[0].upper() + s[1:] if s else s
        if s and not re.fullmatch(r'[\W\d]+', s):
            clean.append(s)
    return clean


# ───────────── Metadaten ─────────────
def minuten(t):
    if not t:
        return None
    t = sauber(t).lower().replace(',', '.')
    total = 0
    found = False
    for zahl_a, zahl_b, einh in re.findall(r'(\d+(?:\.\d+)?)\s*(?:-|–|bis)?\s*(\d+(?:\.\d+)?)?\s*(std|stunden?|h\b|min)', t):
        v = float(zahl_b or zahl_a)
        total += v * 60 if einh.startswith(('std', 'stund', 'h')) else v
        found = True
    return int(round(total)) if found and 0 < total < 24 * 60 else None


def portionen_aus(box, secs, intro):
    tabelle = re.findall(r'(?:Portionen|Personen|Menge)\W{0,12}([^\n]{0,30})', '\n'.join(l for _, _, z in secs for l in z))
    kandidaten = [box.get('Portionen', '')] + [h for _, h, _ in secs] + [intro] + [('für ' + t) for t in tabelle]
    for k in kandidaten:
        if not k:
            continue
        s = sauber(k).lower()
        if 'pro person' in s:
            return 1
        m = re.search(r'(?:für|zutaten)\s*\(?\s*(\d+|' + '|'.join(ZAHLWORT) + r')(?:\s*(?:-|–|bis)\s*(\d+))?\s*(?:personen|portionen|person|portion|stück|leute)', s)
        if not m:
            m = re.search(r'^(\d+)(?:\s*(?:-|–|bis)\s*(\d+))?\s*(?:personen|portionen|person|portion)', s)
        if m:
            a = m.group(1)
            n = int(a) if a.isdigit() else ZAHLWORT.get(a)
            if m.group(2):
                n = int(m.group(2))
            if n and 0 < n <= 40:
                return int(n)
    return None


def titel_aus(p, intro_lines):
    for line in intro_lines[:15]:
        m = re.match(r"^\s*'''([^']+)'''", line)
        if m:
            return sauber(m.group(1))
    return p['t'].split('/', 1)[-1].strip()


def beschreibung_aus(intro_lines, titel):
    roh = '\n'.join(intro_lines)
    roh = re.sub(r'<!--.*?-->', '', roh, flags=re.S)
    roh = entferne_vorlagen(roh)
    roh = re.sub(r'<gallery[^>]*>.*?</gallery>', '', roh, flags=re.S | re.I)
    roh = re.sub(r'\{\|.*?\|\}', '', roh, flags=re.S)
    intro_lines = roh.split('\n')
    text = []
    for line in intro_lines:
        s = line.strip()
        if not s or s.startswith(('{', '|', '!', '[[', '__', '=', '*', '#', ':', ';')):
            if text and not s:
                break
            continue
        c = sauber(s)
        if not c or c == titel or re.match(r'^(Für \d|Zubereitungszeit)', c):
            continue
        text.append(c)
    t = ' '.join(text).strip()
    if not t:
        return ''
    # höchstens zwei Sätze, max. 220 Zeichen
    saetze = re.split(r'(?<=[.!?])\s+', t)
    out = ''
    for s in saetze:
        if len(out) + len(s) > 220:
            break
        out = (out + ' ' + s).strip()
    return out or t[:217].rsplit(' ', 1)[0] + ' …'


SUESS_KAT = {'Desserts', 'Torten', 'Eis', 'Pudding', 'Süßigkeiten', 'Weihnachtsgebäck', 'Süßspeisen', 'Kekse', 'Plätzchen'}
BACK_KAT = {'Gebäck und Kuchen', 'Gebäck', 'Kuchen', 'Backen'}
SUESS_RE = re.compile(r'zucker|honig|schokolade|kakao|vanille|marmelade|konfitüre|sirup|rosinen|marzipan|nougat', re.I)


def typ_aus(kats, titel, zutaten=()):
    def ist_suess(z):
        n = z['name'].lower()
        if re.search(r'puderzucker|vanillezucker|schokolade|kakao|marzipan|nougat|kuvertüre|zuckerguss', n): return True
        if not SUESS_RE.search(n): return False
        m, e = z.get('menge'), z.get('einheit')
        # eine Prise / ein Teelöffel Zucker im Hefeteig macht noch keinen Nachtisch
        return m is not None and ((e == 'g' and m >= 40) or (e == 'kg') or (e == 'EL' and m >= 2) or e in ('Tasse', 'Becher', 'Glas'))
    suess = any(ist_suess(z) for z in zutaten)
    ks = set(kats)
    if ks & {'Suppen und Eintöpfe', 'Suppen', 'Eintöpfe'}: return 'suppe'
    if ks & {'Salatrezepte', 'Salat', 'Salate'}: return 'salat'
    if ks & SUESS_KAT: return 'dessert'
    if ks & BACK_KAT:
        if suess: return 'dessert'
        if ks & {'Brot und Brötchen'}: return 'fruehstueck'
        return 'hauptgericht'                      # herzhaftes Gebäck: Zwiebelkuchen, Flammkuchen …
    if ks & {'Frühstück', 'Brot und Brötchen', 'Brotaufstriche', 'Aufstriche', 'Snacks', 'Müsli'}: return 'fruehstueck'
    tl = titel.lower()
    if re.search(r'suppe|eintopf|brühe', tl): return 'suppe'
    if re.search(r'salat', tl): return 'salat'
    if re.search(r'kuchen|torte|keks|plätzchen|muffin|waffel', tl) and suess: return 'dessert'
    if re.search(r'creme|pudding|mousse|eis\b|kompott', tl): return 'dessert'
    if re.search(r'brot|brötchen|müsli|aufstrich|marmelade', tl): return 'fruehstueck'
    return 'hauptgericht'


def slug(t):
    t = t.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss')):
        t = t.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:60]


# ───────────── Hauptlauf ─────────────
def main():
    if '--offline' in sys.argv and os.path.exists(SRC):
        D = json.load(open(SRC))
    else:
        print('Lade Rezeptseiten von de.wikibooks.org …')
        D = lade_seiten()
        json.dump(D, open(SRC, 'w'), ensure_ascii=False)
        print(len(D), 'Seiten geladen')
    rezepte, abgelehnt = [], []
    ids = set()
    for p in D:
        x = p['x']
        grund = None
        if re.match(r'^\s*#(?:weiterleitung|redirect)', x, re.I):
            grund = 'Weiterleitung'
        kats = kategorien(x)
        if not grund and any(k in AUSSCHLUSS_KAT for k in kats):
            grund = 'Getränk/Soße/Grundrezept: ' + ', '.join(k for k in kats if k in AUSSCHLUSS_KAT)
        if not grund and re.search(r'vorlage|navigationsleiste|projektideen|techniken', p['t'], re.I):
            grund = 'keine Rezeptseite'
        if grund:
            abgelehnt.append({'seite': p['t'], 'grund': grund}); continue

        box = rezeptbox(x)
        secs = abschnitte(x)
        bloecke = gruppiere(secs)
        intro = secs[0][2]
        titel = titel_aus(p, intro)
        zutaten = zutaten_aus(bloecke)
        schritte = schritte_aus(bloecke)
        if not schritte:
            # Zubereitung als Fließtext direkt unter der Zutatenliste (ohne eigene Überschrift)
            absaetze, cur = [], []
            for art, _, zeilen in bloecke:
                if art != 'zutaten':
                    continue
                for line in zeilen + ['']:
                    if line.strip() and not line.lstrip().startswith(('*', '#', ';', ':', '{', '|', '[[', '=')):
                        cur.append(line)
                    elif cur:
                        absaetze.append(sauber(' '.join(cur))); cur = []
            schritte = [a for a in absaetze if len(a.split()) >= 8]

        fehler = []
        if len(zutaten) < 2: fehler.append(f'zu wenige Zutaten erkannt ({len(zutaten)})')
        if not schritte: fehler.append('keine Zubereitung erkannt')
        if schritte and sum(len(s.split()) for s in schritte) < 8: fehler.append('Zubereitung zu kurz')
        if not titel or len(titel) > 80: fehler.append('Titel fehlt')
        if fehler:
            abgelehnt.append({'seite': p['t'], 'grund': '; '.join(fehler)}); continue

        zeit = minuten(box.get('Zeit bis Servierung')) or minuten(box.get('Zubereitungszeit'))
        if not zeit:
            m = re.search(r'(\d+)\s*Min\.?\s*Zubereitung', ' '.join(intro))
            zeit = int(m.group(1)) if m else None
        if not zeit:
            m = re.search(r'(?:Gesamtzeit|Zeit bis (?:zur )?Servierung|Zubereitungszeit|Arbeitszeit|Zubereitungsdauer|Dauer)\W{0,12}([^\n]{0,40})', x, re.I)
            zeit = minuten(m.group(1)) if m else None
        portionen = portionen_aus(box, secs, ' '.join(intro[:20]))
        tags = []
        veg = (box.get('Vegetarisch') or '').lower()
        if 'Vegane Rezepte' in kats or veg.startswith('vegan'):
            tags += ['vegan', 'vegetarisch']
        elif 'Vegetarische Rezepte' in kats or veg.startswith('ja'):
            tags.append('vegetarisch')
        if zeit and zeit <= 30:
            tags.append('schnell')
        typ = typ_aus(kats, titel, zutaten)

        rid = 'wb-' + slug(titel)
        if rid in ids:
            rid += '-' + str(p['id'])
        ids.add(rid)
        seite = p['t'].replace(' ', '_')
        from urllib.parse import quote
        r = {
            'id': rid,
            'titel': titel,
            'emoji': EMOJI[typ],
            'beschreibung': beschreibung_aus(intro, titel),
            'zeit': zeit,
            'portionen': portionen,
            'tags': tags,
            'typ': typ,
            'zutaten': zutaten,
            'schritte': schritte,
            'lizenz': {
                'name': 'CC BY-SA 4.0',
                'url': 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
                'titel': titel,
                'urheber': 'den Wikibooks-Autorinnen und -Autoren',
                'quelle': f'https://de.wikibooks.org/w/index.php?oldid={p["rev"]}',
                'quelleSeite': 'https://de.wikibooks.org/wiki/' + quote(seite),
                'versionen': f'https://de.wikibooks.org/w/index.php?curid={p["id"]}&action=history',
                'sammlung': 'Wikibooks-Kochbuch',
                'sammlungUrl': 'https://de.wikibooks.org/wiki/Kochbuch',
                'stand': p['ts'][:10],
                'aenderungen': 'in Felder gegliedert (Zutaten mit Menge und Einheit, nummerierte Arbeitsschritte), '
                               'Wiki-Formatierung, Bilder und Zusatzabschnitte entfernt, Einheiten vereinheitlicht',
            },
        }
        rezepte.append(r)

    rezepte.sort(key=lambda r: r['titel'].lower())
    json.dump({
        '_hinweis': 'Rezepte aus dem deutschsprachigen Wikibooks-Kochbuch (de.wikibooks.org/wiki/Kochbuch). '
                    'Erzeugt aus den Seiten der Kategorie „Kochbuch/ Alle Rezepte“.',
        '_lizenz': {
            'text': 'Die Rezepte stammen aus dem Wikibooks-Kochbuch und stehen unter der Lizenz Creative Commons '
                    'Namensnennung – Weitergabe unter gleichen Bedingungen 4.0 International (CC BY-SA 4.0). '
                    'Diese bearbeitete Fassung steht ebenfalls unter CC BY-SA 4.0. Originalseite, Versionsgeschichte '
                    '(Autorinnen und Autoren) und Änderungen stehen bei jedem Rezept im Feld "lizenz".',
            'name': 'CC BY-SA 4.0',
            'url': 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
            'rechtstext': 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.de',
        },
        'rezepte': rezepte,
    }, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'uebernommen': len(rezepte), 'abgelehnt': abgelehnt}, open(REPORT, 'w'), ensure_ascii=False, indent=1)
    print(len(rezepte), 'übernommen,', len(abgelehnt), 'aussortiert')


if __name__ == '__main__':
    main()

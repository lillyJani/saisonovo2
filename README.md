# Nachhaltige Ernährungs-App

Mobile Web-App für nachhaltiges Einkaufen und Kochen — mit Saisonkalender, Barcode-Scanner, Challenges und persönlichem Score. Kein Build-Tool, kein Framework, läuft komplett im Browser.

---

## App öffnen

Die App läuft direkt im Browser, kein Download nötig:

👉 **[lillyjani.github.io/saisonovo](https://lillyjani.github.io/saisonovo2/)**

### Als App zum Homescreen hinzufügen

Im besten Fall sollte gleich eine Meldung kommen die anfragt die App zu installieren wenn es im Browser geöffnet wird.

**iPhone / iPad (Safari):**
1. Den Link oben in Safari öffnen
2. Auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben, in der unteren Menüleiste)
3. Im Menü nach unten scrollen und **„Zum Home-Bildschirm"** auswählen
4. Namen bestätigen und oben rechts auf **„Hinzufügen"** tippen

**Android (Chrome):**
1. Den Link oben in Chrome öffnen
2. Oben rechts auf die drei Punkte (⋮) tippen
3. **„App installieren"** bzw. **„Installieren und Verküpfen"** auswählen
4. Bestätigen

Die App erscheint danach als eigenes Icon auf dem Homescreen (Saisonovo-Logo, siehe `manifest.json`/`apple-touch-icon.png`) und öffnet sich beim Antippen wie eine normale App, ohne Adressleiste des Browsers.

---

## Projektstruktur

```
saisonovo/
├── index.html             ← App-Shell (Navigation, Tab-Container)
├── style.css              ← Gesamtes Styling (CSS Custom Properties, Hell-/Dunkelmodus)
├── app.js                 ← Gesamte App-Logik
├── logo_ohne_schrift.svg  ← App-Logo (u. a. im Onboarding)
├── manifest.json          ← PWA-Manifest (Homescreen-Name, Icons, Standalone-Modus)
├── apple-touch-icon.png   ← Homescreen-Icon für iOS (180×180, aus dem Logo generiert)
├── icon-192.png           ← Homescreen-Icon für Android/Chrome (192×192)
├── icon-512.png           ← Homescreen-Icon für Android/Chrome (512×512)
├── favicon-32.png         ← Browser-Tab-Icon (32×32)
├── Jost/                  ← Selbst gehostete Sans-Serif-Schrift (UI-Text)
├── Playfair_Display/      ← Selbst gehostete Serif-Schrift (große Überschriften)
├── tabs/
│   ├── home.html          ← Food-Profil, Challenges, Mythos-Karten
│   ├── list.html          ← Einkaufsliste
│   ├── scan.html          ← Barcode- und PLU-Scanner
│   ├── season.html        ← „Saisonküche": Saisonkalender + Kochbuch (Umschalter)
│   ├── profile.html       ← Profil (Name, Avatar, Level, Level-Details, Abzeichen-Verzeichnis, Wirkung)
│   └── onboarding.html    ← 4-Schritte-Onboarding
├── features.js            ← Kochbuch, Punkte/Level/Serien/Abzeichen, Wirkung (Erweiterung zu app.js)
├── features.css           ← Styling der Erweiterungen
├── rezepte.json           ← 28 saisonale Rezepte für das Kochbuch (mit Gerichtsart für die Kategorien)
├── saisondaten3.json      ← Saisondaten für ~80 Obst- und Gemüsesorten
├── ernaehrung.json        ← CO₂-/Umweltdaten und pflanzliche Alternativen
├── warenkorb.json         ← Referenz-Warenkorb (Ø-Deutschland-Vergleich im Food-Profil)
├── plu-codes.json         ← PLU-Codes für loses Obst & Gemüse
├── server.js              ← Node.js/Express Backend (optional)
└── package.json           ← Backend-Abhängigkeiten
```

---

## Frontend starten

Die Tabs werden per `fetch()` aus dem `tabs/`-Ordner geladen, daher ist ein lokaler Server nötig.

```bash
python3 -m http.server 4173
```

Dann im Browser öffnen:

```
http://127.0.0.1:4173/
```

---

## Features

### Onboarding (4 Schritte)
- Intro-Screen mit Logo und Einstieg
- Name eingeben
- Ernährungsart wählen (Alles, Vegetarisch, Vegan, …)
- Optional eine oder mehrere Start-Challenges wählen (einzeln an-/abwählbar), oder überspringen
- Wer bereits vegan/frutarisch bzw. vegetarisch lebt, startet mit Bonus-Punkten (75 bzw. 50)

### Home
- **Dynamische Begrüßung** je nach Tageszeit (Morgen / Tag / Abend)
- **Food-Profil-Karte** — Ringdiagramm zeigt den Vergleich zum deutschen Durchschnitt (rollierendes 7-Tage-Fenster, „Letzte 7 Tage"); die 4 Kacheln darunter (CO₂, Landnutzung, Wasser, Energie) zeigen die absoluten Wochenwerte, grün/rot je nachdem ob besser/schlechter als Ø Deutschland
- **Tagesheld-Stern** — erscheint nach 5 guten Entscheidungen am Tag, resettet nach 24 Stunden
- **Challenges** — wöchentliche Ziele mit Level-Up-System (Ziel steigt nach jedem Abschluss um 50 %); aktive Challenge wird zuerst angezeigt, beliebig viele gleichzeitig wählbar
- **Mythos vs. Fakten** — wöchentlich wechselnde Themenkarten mit Swipe-Navigation
- Rezeptvorschlag mit echten Zutaten — öffnet ein Zutaten-Sheet (wie beim Rezept-Import) zum Auswählen und direkten Hinzufügen zur Einkaufsliste

### Einkaufsliste
- **Scanner direkt in der Liste**: Scanner-Symbol links neben dem Eingabefeld (wie im Kochbuch „Gespeichert“ neben der Suche). Ein Fenster in der Bildschirmmitte fragt: **Kamera nutzen** oder **Barcode/PLU eingeben**. Der Scanner hat dadurch keinen eigenen Menüpunkt mehr (Menüleiste: Home · Saisonküche · Liste · Profil); von der Scanner-Seite geht es über „‹ Einkaufsliste“ zurück
- Rezept-Import per Link öffnet sich als Fenster in der Bildschirmmitte
- Autocomplete mit Saisonbewertung (🟢 🟡 🔴) direkt beim Tippen
- **Öko-Swaps** — bei nicht-nachhaltigen Produkten werden Alternativen vorgeschlagen
- Artikel-Detailansicht mit Saisonverlauf, Herkunftsländern und CO₂-Vergleich
- Rezept-Import per Link (extrahiert Zutaten automatisch)
- Einkauf abschließen → vergibt Score-Punkte

### Scanner
- **Barcode-Scanner** via ZXing-Bibliothek (Kamerazugriff)
- **PLU-Code** per Kamera-OCR oder manueller Eingabe (5-stellig = Bio)
- Saison-Banner direkt im Ergebnis: 🟢 In Saison / 🟡 Bedingt / 🔴 Nicht in Saison
- Open Food Facts Integration für verpackte Produkte (Eco-Score, Nutri-Score, Herkunft)

### Navigation & Raster *(neu)*
- Fünf Menüpunkte: Home · Saisonküche · **Scannen (Mitte)** · Liste · Profil
- Alle neuen Layouts laufen auf einem **9-Spalten-Raster** (`.g9` + `.span-1` … `.span-9` in `features.css`); die Menüpunkte sitzen auf den Spalten 1 · 3 · 5 · 7 · 9

### Saisonküche *(neu: Saisonkalender + Kochbuch in einem Tab)*
- Oben ein Umschalter **Saisonkalender | Kochbuch**
- Kochbuch, oberste Zeile: **Gespeichert** (links, mit Anzahl) und das **Suchfeld** über die restliche Breite – die Suche filtert direkt die Rezeptliste darunter
- Darunter **drei gleich große Kacheln** (je 3 Rasterspalten, nur Überschrift): **Rezept des Tages** (öffnet das komplette Rezept im Fenster, wechselt täglich, passend zu Saison und Ernährung), **Kategorien** (In Saison, Vegetarisch, Vegan, Laktosefrei, Ohne Gluten, Schnell, Hauptgerichte, Suppen & Eintöpfe, Salate, Frühstück & Snacks, Süßes) und **Rezept importieren** (per Link). Jede Kachel hat einen kleinen **Info-Knopf**, der erklärt, wie sie funktioniert
- Im Overlay kann man von Kategorie → Rezept navigieren und mit „‹ Zurück“ schrittweise zurückgehen; „Gespeichert“ öffnet ebenfalls ein Overlay (Favoriten + per Link importierte Rezepte)
- Unter den Kacheln: alle Rezepte, nach aktueller Saison sortiert
- In der Lebensmittel-Detailansicht des Kalenders werden passende Rezepte angezeigt

### Profil *(neu, Aufbau wie bei Duolingo)*
- **Einstellungen**: nur ein Zahnrad oben rechts; öffnet ein freischwebendes Fenster (Profilbild, Name, Ernährungsart, Dunkelmodus), schließbar über das X oben rechts oder „Speichern“ unten
- Name oben links → großer Avatar (mit Level-Symbol) → „Level X“ → Level-Details (Punkte, Serie, Fortschritt, alle Stufen, zuletzt verdiente Punkte)
- **Abzeichen** als runde Bilder mit Fortschrittsring, darunter Name und wofür es sie gibt. Zugeklappt als horizontal wischbare Reihe (erreichte zuerst), über „Alle Abzeichen anzeigen“ ausklappbar zum kompletten Verzeichnis nach Bereichen (Scannen, Kochen, Einkaufen, Dranbleiben, Monatsabzeichen)
- **Monatsabzeichen**: für jeden Monat ein eigenes Abzeichen (z. B. „November-Held:in“), wenn in diesem Monat 20 nachhaltige Gerichte aus dem Kochbuch gekocht wurden

### Kochbuch
- 28 saisonale Rezepte, sortiert nach dem, was **diesen Monat** in Saison ist — die Saison-Ampel jedes Rezepts wird live aus `saisondaten3.json` berechnet
- Filter: In Saison · Vegan · Vegetarisch · ≤ 30 Min. · Favoriten, plus Suche nach Rezept oder Zutat
- Rezept-Detail mit Portionsrechner, Saison-Ampel pro Zutat, geschätztem CO₂ pro Portion und Schritt-für-Schritt-Anleitung
- „Zutaten auf die Einkaufsliste" (nutzt das bestehende Zutaten-Sheet) und „Gekocht!" (+10 Punkte, +5 Saison-Bonus)
- Per Link importierte Rezepte lassen sich im Kochbuch speichern
- Startseite zeigt wöchentlich wechselnd ein Saisonrezept aus dem Kochbuch

### Punkte & Gamification *(neu)*
- **Level** (Samenkorn → Saisonovo-Legende) auf Basis aller Punkte, mit Fortschrittsbalken
- **Serie**: Tage in Folge aktiv (scannen, kochen, einkaufen, Alternative wählen) mit Bonus nach 3/7/14/30 Tagen
- **15 Abzeichen** mit Fortschrittsanzeige (z. B. Scanner-Profi, Saisonküche, Wochenflamme, Klimaschützer:in)
- Neue Punktequellen: Scans (+2, +3 Bonus bei Saison/Öko-Score A–B, 1× pro Produkt und Tag, max. 30/Tag), Kochen, abgeschlossene Einkäufe (+5, +1 je saisonalem Artikel)
- Zwei neue Challenges: „Scanner-Profi" und „3 Saisonrezepte kochen"
- Leiste auf der Startseite: Level · Serie · gespartes CO₂

### Deine Wirkung – Nachhaltigkeitszahlen *(neu)*
- Gespartes CO₂ und virtuelles Wasser im Vergleich zu einem gleich schweren Ø-Einkauf in Deutschland
- Anschauliche Vergleiche (Autokilometer, Buchen-Tage), Saisonquote, Wirkung gekaufter Alternativen
- Verlauf der letzten 6 Monate und offengelegte Berechnungsmethode mit Quellen
- Im Scanner: Klimabilanz des Produkts (kg CO₂/kg vs. Ø Lebensmittel), Punkte und passende Rezepte direkt im Scan-Ergebnis

### Rezept importieren *(neu)*
- Kachel **Rezept importieren** im Kochbuch (und Knopf in der Einkaufsliste) öffnet ein Fenster mit zwei Wegen: **Link** oder **Text einfügen**
- Seiten werden über den Lesedienst **r.jina.ai** abgerufen (frei nutzbar, ohne Schlüssel; Ersatz: öffentliche CORS-Proxys). Hinweis: Die früher genutzten Proxys (corsproxy.io u. a.) verlangen inzwischen einen API-Schlüssel bzw. antworten nicht mehr. Seiten mit Bot-Schutz (z. B. REWE) lassen sich nicht immer lesen – dann hilft „Text einfügen“
- **Link:** Rezeptseiten (Chefkoch, Blogs u. v. m.) werden über schema.org-Daten komplett ausgelesen: Titel, Bild, Beschreibung, Portionen, Zeit, Zutaten, Zubereitung
- **Instagram:** Öffentliche Beiträge und Reels werden über die Einbettungsseite gelesen; die Beschreibung wird als Rezept ausgewertet (Zutatenliste, nummerierte Schritte, „Zutaten:“/„Zubereitung:“, Portionen, Zeit, Hashtags werden entfernt). Blockiert Instagram das Auslesen, wechselt das Fenster zu „Text einfügen“ und behält den Link als Quelle
- **Text einfügen:** beliebiger Rezepttext (z. B. kopierte Instagram-Beschreibung) wird genauso ausgewertet
- Das Ergebnis erscheint wie jedes Kochbuch-Rezept: Saison-Ampel je Zutat, CO₂ pro Portion, Portionsrechner, Zubereitung, „Gekocht!“-Punkte, Link zur Quelle. Ernährung (vegan/vegetarisch) und Rezeptart werden automatisch erkannt, damit es auch in den Kategorien auftaucht
- **Zutaten auf die Einkaufsliste:** Auswahl per Haken; das Rezept bleibt dabei offen
- **Speichern** legt das Rezept dauerhaft unter **Gespeichert → Importierte Rezepte** ab (`gruenkorb-kochbuch`), entfernen über „Rezept aus dem Kochbuch entfernen“

### Eigene Obst- & Gemüse-Icons *(neu)*
- `produkt-icons.svg`: 119 selbst gezeichnete Icons, eins für jedes Produkt in `saisondaten3.json` (Symbol-ID `pi-<produkt-id>`), einheitlicher flacher Stil mit Schatten und Glanzlicht
- Die Datei wird beim Start einmal geladen und eingefügt; `produktIcon(id)` liefert das Icon, `_getProduktEmoji()` gibt für bekannte Produkte jetzt das Icon statt des Emojis zurück
- Zu sehen in: Saisonkalender, Detailseite (inkl. „Gerade in Saison“), Einkaufsliste, Vorschläge beim Tippen, Scan-Ergebnis und bei Rezeptzutaten
- Lebensmittel ohne eigenes Icon (z. B. Haferflocken, Milchprodukte) behalten ihr Emoji

### Scan-Backend mit Cache & Preisen *(neu, PHP – Details in `api/README.md`)*
- `api/scan.php?ean=…`: prüft die EAN und liest den JSON-Cache (`api/data/products/<ean>.json`). Stammdaten werden nach 30 Tagen, Preise nach 24 Stunden neu geladen
- Quellen: **Open Food Facts v2** für Eco-Score, Nutri-Score, Siegel, Verpackung, Zutaten und Nährwerte, **Open Prices** für Community-Preise. Adapter für **Pepesto REWE**, **Apify REWE** und **Preiszeiger** sind vorbereitet und ohne Schlüssel inaktiv
- Antwort im bisherigen OFF-Format, ergänzt um `prices`, `price_summary`, `sustainability` und `_meta`. Fehlercodes 400, 404, 502 und 504; fällt eine Quelle aus, kommt der Cache-Stand mit dem Hinweis „ältere Daten“
- Speicher und Quellen sind über Schnittstellen austauschbar (`ProductRepository`, `ProductInfoSource`, `PriceSource`). Für SQLite/MySQL genügt eine neue Repository-Klasse
- Die Scan-Karte zeigt die Preisspanne, den Durchschnitt, die letzten Meldungen, Siegel und Verpackung
- Ohne PHP-Backend (GitHub Pages, Live Server) fragt die App Open Food Facts und Open Prices direkt aus dem Browser ab, dann ohne Cache
- Lokal starten: `php -S localhost:8000` im Projektordner, dann http://localhost:8000 öffnen

### Scanner-Korrekturen *(26.11.)*
- Die Kamera-Erkennung wird beim Stoppen jetzt wirklich beendet (`reader.reset()`). Vorher lief sie weiter, und alte Erkennungen öffneten später von selbst das zuletzt gescannte Produkt
- Ein gerade geschlossenes Produkt wird erst wieder erkannt, wenn es kurz (≥ 1,2 s) aus dem Bild war
- „Zur Einkaufsliste hinzufügen“ bleibt im Scanner (Bestätigung + „×2“ bei erneutem Tippen) und speichert die gescannten Daten am Artikel (`item.scan`)
- Die Detailseite eines gescannten Artikels zeigt Öko-Score, Nutri-Score, NOVA, Herkunft, Kategorie, Siegel, Verpackung und Preis. Bei älteren Artikeln werden die Daten über den Scan-Verlauf nachgeladen
- Kategorie-Symbole vergleichen ganze Wörter: Pfefferminze bekommt kein Paprika-Symbol mehr, dazu neue Symbole für Tee, Kaffee, Kräuter, Nüsse und Honig

### REWE-Preise über Pepesto & Apify *(26.11.)*
- Die Scan-Karte und die Detailseite in der Einkaufsliste zeigen „Im Supermarkt“: tagesaktueller REWE-Online-Preis (Pepesto) und REWE-Preis in deiner Nähe (Apify, per Postleitzahl), jeweils mit Angebot, Grundpreis und zugeordnetem Artikelnamen
- Die Postleitzahl stellst du unter Profil → Einstellungen → Einkaufen ein
- Die Quellen sind aktiv, sobald im Backend (`api/config.local.php`) ein Pepesto-Schlüssel bzw. Apify-Token eingetragen ist. Beide brauchen das PHP-Backend, Schlüssel gehören nie in den Browser
- Keine EAN bei beiden Anbietern, deshalb Zuordnung über Marke, Name und Packungsgröße. Unsichere Treffer werden nicht angezeigt (Details in `api/README.md`)

### Einkaufsliste nach Bereichen *(26.11.)*
- Offene Artikel werden in der Reihenfolge eines typischen Supermarkt-Rundgangs gruppiert: Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch/Wurst/Fisch, Nudeln/Reis/Konserven, Frühstück & Süßes, Gewürze/Öle/Backzutaten, Getränke/Tee/Kaffee, Tiefkühl, Drogerie & Haushalt, Sonstiges. Innerhalb eines Bereichs alphabetisch, erledigte Artikel unten
- Zuordnung (`listKategorie()` in `features.js`): gescannte Open-Food-Facts-Kategorien, dann Stichwörter für verarbeitete Produkte (z. B. Tomatenmark → Konserven, Paprikapulver → Gewürze), dann Saisonkalender, dann Lebensmitteldaten. Artikel ohne eigenes Symbol zeigen das Symbol ihres Bereichs
- Abhaken (Kreis links) = **eingekauft**. Jeder abgehakte Artikel wird sofort gewertet (`listRecordPurchase` in features.js):
  - Das erste Lebensmittel eines Tages zählt als Einkauf und bringt +5 Punkte.
  - Saisonale Artikel bringen je +1 Punkt, höchstens 10 pro Tag.
  - Die CO₂- und Wasser-Bilanz sowie die Challenges werden mitgezählt. Ein Tag ohne Fleisch oder Fisch zählt nach Tagesende für die Veggie-Woche.
  - Wird der Haken am selben Tag zurückgenommen, verschwindet der Artikel wieder aus der Bilanz. Punkte gibt es pro Artikel nur einmal.
- **Aktualisieren entfernt eingekaufte Artikel** (`listClearBought` in features.js): beim Neuladen der App und durch Herunterziehen der Einkaufsliste (eigene Geste, funktioniert auch in der installierten App). Sie sind beim Abhaken schon gewertet und bleiben in der Einkaufs-Historie.
- Beim Antippen des leeren Eingabefelds erscheinen Vorschläge: „Oft gekauft“ (aus der Einkaufs-Historie) und „Jetzt in Saison“. Beim Tippen erscheint wie bisher die Autovervollständigung.

### Saisonkalender
- Oben links der **Scanner** (öffnet dasselbe Fenster wie in der Einkaufsliste: Kamera oder Code eingeben), rechts daneben die Suche. Der Zurück-Knopf im Scanner führt wieder zum Saisonkalender
- Monatsübersicht aller regionalen Obst- und Gemüsesorten
- Filterbar nach Kategorie
- Direkt zur Einkaufsliste hinzufügen

### Profil
- **Deine Historie** — Alternativen, Einkäufe und abgeschlossene Challenges im Überblick
- Ernährungsart-Tags
- Challenges-Übersicht (alle verfügbaren Challenges, aktive zuerst)
- **Einstellungen-Button** (oben rechts, Zahnrad-Icon) öffnet die Bearbeiten-Ansicht: Profilbild, Name, Ernährungsart ändern (Punkte werden angepasst) sowie den **Dunkelmodus**-Schalter

---

### Fenster *(neu)*
- Alle Fenster der App (Einkauf abschließen, Scan-Ergebnis, Scanner-Auswahl, Rezept-Import, Mythos vs. Fakten, Challenge-Auswahl, Kochbuch-Overlays, Wirkung, Punkte-Info, Abzeichen, Tagesheld, Install-Hinweis) öffnen sich als freie Fenster in der Bildschirmmitte – mit Abstand zu allen Rändern und eigenem Scrollbereich, wenn der Inhalt länger ist

## Datenpersistenz

Alle Nutzerdaten werden im `localStorage` gespeichert — kein Login, kein Backend nötig für den Basisbetrieb.

| Key | Inhalt |
|-----|--------|
| `gruenkorb-profile` | Name, Avatar, Ernährungsart |
| `gruenkorb-score` | Total, Swaps, Einkäufe, Diät-Bonus, abgeschlossene Challenges |
| `gruenkorb-list` | Einkaufsliste-Einträge |
| `gruenkorb-challenges` | Ausgewählte Challenges |
| `gruenkorb-challenge-progress` | Fortschritt + Level je Challenge |
| `gruenkorb-daily-decisions` | Tageszähler für Tagesheld-Stern |
| `gruenkorb-myths-read` | Gelesene Mythos-Karten |
| `gruenkorb-einkauf-history` | Abgeschlossene Einkäufe (für das rollierende Food-Profil) |
| `gruenkorb-theme` | Hell-/Dunkelmodus |
| `gruenkorb-gamification` | Scans, Gekochtes, Serie, Abzeichen, Punkte-Log |
| `gruenkorb-scan-history` | Letzte 300 Scans (für Saisonquote & Abzeichen) |
| `gruenkorb-kochbuch` | Favoriten und gespeicherte eigene Rezepte |

---

## Design

- CSS Custom Properties: `--green-dark: #0e2907`, `--green-mid: #3a7711`, `--green-light: #c5debf`, `--cream: #fffaeb`
- **Dunkelmodus** (Umschalter unter Profil → Einstellungen), per `data-theme="dark"` auf `<html>`; eigene Variablen für Oberflächen (`--surface`, `--accent-surface`) statt eines simplen Farb-Invert
- Fonts selbst gehostet (kein Google-Fonts-CDN): [Jost](https://fonts.google.com/specimen/Jost) für UI-Text, [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) für große Überschriften
- Subtiler Radial-Gradient-Glow auf der Food-Profil-Karte
- App-artiges Verhalten auf dem Handy: kein Pinch-/Doppeltipp-Zoom, feste Viewport-Breite
- Icons: [Heroicons](https://heroicons.com/) (MIT) + [Tabler Icons](https://tabler-icons.io/) (MIT) — gemischt genutzt, z. B. Tabler für Onboarding-/Profil-Icons, Heroicons für die Navigationsleiste
- Keine externen Frameworks, kein Build-Step

---

## Backend (optional)

Das Backend ist optional — die App läuft komplett ohne. Wird u. a. vom Rezept-Import genutzt (`_fetchRecipe()` versucht zuerst `localhost:3456`, fällt sonst auf einen Browser-seitigen CORS-Proxy zurück), sowie für zukünftige Erweiterungen (Nutzersynchronisation, Server-seitige Saisondaten).

```bash
npm install
npm start
# → API läuft auf http://localhost:3456
```

### API-Endpunkte

| Methode | URL | Beschreibung |
|---------|-----|-------------|
| POST | `/api/auth/register` | Registrieren `{name, email, password}` |
| POST | `/api/auth/login` | Einloggen `{email, password}` |
| GET | `/api/auth/me` | Eigenes Profil |
| PATCH | `/api/auth/me` | Profil aktualisieren |
| GET | `/api/foods` | Lebensmittel suchen `?q=tomate` |
| GET | `/api/foods/:id` | Einzelnes Lebensmittel |
| GET | `/api/season` | Saisonkalender `?month=6` |
| GET | `/api/list` | Einkaufsliste |
| POST | `/api/list` | Artikel hinzufügen |
| PATCH | `/api/list/:itemId` | Abhaken / Menge ändern |
| DELETE | `/api/list/:itemId` | Artikel löschen |
| DELETE | `/api/list/done/all` | Alle abgehakten Artikel löschen |
| GET | `/api/scan/:barcode` | Barcode-Lookup |
| GET | `/api/stats` | Statistiken |
| GET | `/api/recipe` | Rezept per URL importieren (JSON-LD-Extraktion) |

## Rezepte aus dem Open Recipe Corpus (CC BY-SA 4.0)

Zusätzlich zu `rezepte.json` lädt das Kochbuch die Datei `rezepte-orc.json`, sofern sie vorhanden ist.
Sie wird mit `tools/rezepte-import/import.mjs` erzeugt. Das Skript

1. ruft die Rezepte über die API des [Open Recipe Corpus](https://github.com/Rippy1911/open-recipe-corpus) ab,
2. übersetzt sie mit DeepL oder OpenAI ins Deutsche,
3. prüft Zutaten, Mengen, Temperaturen und Zeiten und
4. speichert sie als JSON.

Die Rezepte erscheinen im Kochbuch, im Rezept des Tages und in der Kategorie „Open Recipe Corpus“.
Jedes Rezept zeigt den Kasten „Quelle & Lizenz“ mit Originalquelle, Urhebern bzw.
Versionsgeschichte, Lizenzlink, Änderungen und dem Hinweis, dass die deutsche Fassung ebenfalls
unter CC BY-SA 4.0 steht. Anleitung: [`tools/rezepte-import/README.md`](tools/rezepte-import/README.md).

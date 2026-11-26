# Saisonovo Scan-API (PHP)

Reichert gescannte EAN-Codes automatisch mit Nachhaltigkeits-, Siegel-, Nährwert- und Preisdaten an
und speichert das Ergebnis in einem lokalen JSON-Cache.

**Voraussetzungen:** PHP ≥ 8.1 mit den Erweiterungen `curl` und `json`. Es gibt keine weiteren Abhängigkeiten und kein Composer.

## Starten

```bash
# lokal (macOS: vorher `brew install php`) – im Projektordner, liefert App UND API aus:
php -S localhost:8000
# App öffnen: http://localhost:8000  ·  API testen: http://localhost:8000/api/scan.php?ean=4008400402222
```

Auf einem PHP-Webspace genügt es, den ganzen Projektordner hochzuladen. Der Ordner `api/data/products/` muss
für PHP beschreibbar sein. Interne Ordner (`src/`, `data/`) sperren die mitgelieferten `.htaccess`-Dateien
unter Apache. Bei nginx sind dafür entsprechende `location`-Regeln nötig. Noch besser ist es, über
`SAISONOVO_DATA_DIR` einen Ordner außerhalb des Webroots einzustellen.

Liegt die API auf einer anderen Domain als die App (z. B. App auf GitHub Pages), trägst du vor `features.js` in
`index.html` ein:

```html
<script>window.SAISONOVO_API_BASE = 'https://dein-server.de/api/';</script>
```

Zusätzlich musst du in `config.local.php` `cors_origin` auf die App-Adresse setzen.

## Ablauf eines Scans

```
Scanner (ZXing) → applyScanResult(ean) → scanLookup(ean)
   ├─ GET api/scan.php?ean=…            (Standard)
   │     ├─ EAN prüfen (Länge, Prüfziffer)            → 400 invalid_ean
   │     ├─ Cache lesen  data/products/<ean>.json
   │     ├─ Stammdaten älter als 30 Tage? → Open Food Facts v2
   │     │     └─ unbekannt → 404 not_found (24 h gemerkt)
   │     ├─ Preise älter als 24 h?        → alle aktiven PriceSources
   │     ├─ zusammenführen, Cache schreiben
   │     └─ Quelle down/Timeout: alter Cache mit cache.stale=true, sonst 502/504
   └─ Backend nicht erreichbar → direkt OFF + Open Prices aus dem Browser (ohne Cache)
```

## Antwort / Cache-Format

Die Antwort hat dieselbe Form wie bei Open Food Facts (`{"status":1,"product":{…}}`). Die App zeigt sie deshalb
mit unverändertem `renderScanResult()` an. Neue Felder kommen nur **zusätzlich** hinzu:

| Feld | Inhalt |
|---|---|
| `product.*` | Originalfelder von OFF (`product_name`, `ecoscore_grade`, `nutriscore_grade`, `labels_tags`, `packaging_materials_tags`, `ingredients_text_de`, `nutriments` je 100 g, …) |
| `product.prices[]` | Einzelpreise im gemeinsamen Format: `source, source_id, price, currency, date, is_discounted, store, city, postcode, country_code, kind` |
| `product.price_summary` | `min, max, median, avg, count, currency, scope` („DE“ oder „all“), `latest`, `since`. Nur Preise der letzten 365 Tage. `null`, wenn keine vorliegen |
| `product.sustainability` | `ecoscore_grade/score, nutriscore_grade, nova_group, organic, labels[], packaging[], packaging_recycling[]` |
| `product._meta` | `product_fetched_at, prices_fetched_at, updated_at, sources{product, prices[]}, price_errors[]` |
| `cache` | `hit, stale, product_age_s, prices_age_s` |
| `warnings[]` | z. B. „Zeitüberschreitung bei … Preise dieser Quelle aus dem Cache.“ |

Die Cache-Datei `data/products/<ean>.json` enthält `schema_version`, `code`, `product` und `_meta`. Bei unbekannten
Produkten steht dort stattdessen `{"not_found": true, "checked_at": …}`.

Fehlerantworten haben die Form `{"status":0,"error":{"code":"invalid_ean|not_found|upstream_timeout|upstream_error|internal_error","message":"…"}}`.

## Aufbau (austauschbar)

```
api/
  scan.php                 Endpunkt
  bootstrap.php            Autoloader + saisonovo_service(): hier werden Speicher & Quellen verdrahtet
  config.php               Einstellungen (Umgebungsvariablen), überschreibbar mit config.local.php
  src/Support/Ean.php      EAN-Prüfung/Normalisierung
  src/Http/HttpClient.php  cURL-Wrapper (User-Agent, Timeouts, JSON, Fehler → SourceException)
  src/Repository/
    ProductRepository.php          Schnittstelle (find/save/delete/all)
    JsonFileProductRepository.php  JSON-Datei pro EAN, mit Sperre und atomarem Schreiben
  src/Source/
    ProductInfoSource.php    Schnittstelle Stammdaten
    OpenFoodFactsSource.php  Open Food Facts v2
    PriceSource.php          Schnittstelle Preise (+ gemeinsames Preisformat)
    OpenPricesSource.php     Open Prices (Community-Preise per EAN)
    AbstractCommercialPriceSource.php
    PepestoReweSource.php    REWE-Katalog (Pepesto), Zuordnung per TextMatch
    ApifyReweSource.php      REWE mit PLZ (Apify), asynchron
    PreiszeigerSource.php    vorbereitet (Gerüst)
  src/Support/TextMatch.php  Zuordnung ohne EAN (Name, Marke, Packungsgröße)
  src/Repository/JsonFileStore.php  Speicher für Kataloge & laufende Abfragen (data/sources/)
  cron.php                   täglicher Katalog-Abruf (nur Kommandozeile)
  src/Service/
    ProductService.php       Ablauf, Cache-Regeln, Zusammenführen
    PriceSummary.php         Preis-Übersicht
```

**Neue Preis-API anbinden:**
1. Eine Klasse in `src/Source/` anlegen, die `PriceSource` erfüllt. Für REST-APIs mit Schlüssel bietet sich `AbstractCommercialPriceSource` an: Dort überschreibst du nur `buildRequest()` und `mapItems()`.
2. Die Klasse in `saisonovo_service()` (bootstrap.php) eintragen.
3. Die Einstellungen in `config.php` ergänzen.

App und `ProductService` bleiben dabei unverändert.

**Supermarkt-Preise (REWE) aktivieren:** Trag die Schlüssel in `config.local.php` ein (Vorlage: `config.local.example.php`).
Ohne Schlüssel bleiben die Quellen aus und stellen keine Anfragen.

| Quelle | Was | Einrichtung | Ablauf |
|---|---|---|---|
| **Pepesto** (`PepestoReweSource`) | Tagesaktueller REWE-Online-Katalog (shop.rewe.de, ca. 1.000–2.000 gängige Lebensmittel), Preise inkl. Angebote | Credits auf pepesto.com kaufen. Den Schlüssel erzeugst du mit `curl -X POST https://s.pepesto.com/api/link -H "Content-Type: application/json" -d '{"email":"…"}'` (er wird nur einmal angezeigt). Dann `'pepesto_rewe' => ['api_key' => 'pep_sk_…']` | `POST /api/catalog {"supermarket_domain":"shop.rewe.de"}` höchstens 1× pro Tag (Pepesto-Empfehlung). Der Katalog wird in `data/sources/` gespeichert. Per Cronjob vorladen: `php api/cron.php` |
| **Apify REWE Market Scraper** (`ApifyReweSource`) | REWE-Suche mit **Postleitzahl** für lokale Marktpreise | Apify-Konto, Actor `scraping_empire/rewe-market` abonnieren, Token unter Console → Settings → API & Integrations. Dann `'apify_rewe' => ['token' => '…', 'zip_code' => '10115']` | Ein Lauf dauert länger als ein Scan, deshalb läuft er asynchron: Der Scan startet ihn und meldet `pending_sources`. Die App fragt nach 20/45/90 s erneut nach. Das Ergebnis gilt 24 h je Suchbegriff und PLZ |

Beide Anbieter liefern **keine EAN**. Das gescannte Produkt wird deshalb über Marke, Name und Packungsgröße
zugeordnet (`src/Support/TextMatch.php`). Übernommen werden nur Treffer mit einer Ähnlichkeit ab `min_match`
(Standard 0,7). Eine andere Packungsgröße oder eine fehlende Marke führt immer zum Verwerfen. Den zugeordneten
REWE-Artikelnamen zeigt die App mit an. Die Postleitzahl stellt man in der App unter Profil → Einstellungen →
„Postleitzahl für Marktpreise“ ein. Sie wird als `&plz=` an `scan.php` übergeben.

Antwort-Erweiterung: `product.price_offers[]` enthält je Supermarkt-Quelle den aktuellen Preis
(`price, is_discounted, unit_price, matched_name, match_score, url, postcode`). `cache.pending_sources[]`
listet Quellen, deren Ergebnis noch aussteht. `price_summary` enthält weiterhin nur die Community-Preise (Open Prices).

**Preiszeiger** (ALDI/LIDL) ist weiterhin nur als Gerüst vorbereitet (`PreiszeigerSource`).

**Umstieg auf SQLite/MySQL:**
1. `PdoProductRepository implements ProductRepository` schreiben, z. B. Tabelle `products(ean PRIMARY KEY, record JSON, updated_at)` oder normalisiert mit einer eigenen Tabelle `prices`.
2. In `saisonovo_service()` die Klasse austauschen.
3. Den Bestand mit `JsonFileProductRepository::all()` übernehmen.

**Bulk-Import:** Für viele Produkte auf einmal eignen sich die OFF-Dumps (CSV/JSONL,
https://world.openfoodfacts.org/data). Sie lassen sich per Skript über `ProductRepository::save()` einspielen.

## Datenquellen & Lizenzen

- Open Food Facts: Open Database License (ODbL). Bei Anzeige „Daten: Open Food Facts“ nennen. Ein eigener User-Agent ist Pflicht (`user_agent` in config.php).
- Open Prices: ODbL, Community-Daten aus Kassenbons und Preisschildern. Sie sind nicht tagesaktuell für jeden Markt.
- Pepesto, Apify und Preiszeiger: kommerziell. Nutzungsbedingungen und Speicherdauer laut Vertrag beachten.

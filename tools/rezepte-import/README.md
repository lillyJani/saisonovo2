# Rezept-Import: Open Recipe Corpus → Saisonovo

Holt Rezepte aus dem [Open Recipe Corpus](https://github.com/Rippy1911/open-recipe-corpus)
(Wikibooks/Wikisource, CC BY-SA 4.0), übersetzt sie ins Deutsche, prüft sie und speichert sie
als `rezepte-orc.json` im App-Ordner. Die App lädt diese Datei automatisch zusätzlich zu
`rezepte.json`. Fehlt sie, läuft alles wie bisher.

```
recipes.airon.app ─① abrufen─▶ ③ Vorprüfung ─② DeepL/OpenAI─▶ ③ Prüfung ─④─▶ rezepte-orc.json ─⑤─▶ App
```

## Voraussetzungen

- Node.js 18 oder neuer (ohne zusätzliche Pakete)
- **Ein** Übersetzungsschlüssel:
  - **DeepL** (empfohlen): kostenloses API-Konto mit 500.000 Zeichen pro Monat. Ein Rezept hat
    etwa 1.000–2.500 Zeichen, also reicht das für rund 200–400 Rezepte im Monat. Free-Schlüssel
    enden auf `:fx` und werden automatisch erkannt.
  - **OpenAI**: kostenpflichtig, Modell `gpt-4o-mini`. Die Kosten liegen bei wenigen Cent für
    100 Rezepte.

Den Schlüssel **nie** in eine Datei im App-Ordner schreiben, sondern nur beim Aufruf setzen.
Sonst wäre er über die Website öffentlich abrufbar.

## Benutzung

**Standard: englische Rezepte ohne Übersetzung.** Dafür braucht es keinen Schlüssel
(`config.json`: `"fromLang": "en"`, `"provider": "none"`). Die englischen Texte im Korpus sind
dort schon maschinell aus dem Polnischen übersetzt. In der App steht bei diesen Rezepten
„EN · auf Englisch“.

```bash
node import.mjs                                   # englische Rezepte übernehmen (ohne Schlüssel)
node import.mjs --corpus ../../../open-recipe-corpus   # dasselbe aus einem Git-Klon statt über die API

# Deutsch (fromLang "pl" + Übersetzer):
cd tools/rezepte-import

DEEPL_API_KEY=dein-schlüssel node import.mjs --from pl --provider deepl
OPENAI_API_KEY=sk-… node import.mjs --from pl --provider openai
node import.mjs --dry-run --limit 20              # Test: nur abrufen + prüfen, nichts schreiben
DEEPL_API_KEY=… node import.mjs --ids plwb:9356,plwb:10140   # einzelne Rezepte hinzufügen/erneuern
```

- Bereits übersetzte Rezepte werden bei einem erneuten Lauf **nicht noch einmal übersetzt**,
  solange sich Revision und Anbieter nicht ändern. Das spart Zeichen bzw. Kosten.
- API-Antworten liegen im Ordner `cache/`. Wer frische Daten will, löscht ihn.
- Die Rezept-API erlaubt 10 Anfragen pro 10 Sekunden. Das Skript bleibt mit 1 Anfrage pro
  1,1 Sekunden darunter und wartet bei `429` automatisch.

## Einstellungen (`config.json`)

| Feld | Bedeutung |
|---|---|
| `fromLang` | `pl` (empfohlen) oder `en`. Die Originale sind Polnisch, die englischen Texte im Korpus sind selbst schon maschinell übersetzt. Direkt aus dem Polnischen zu übersetzen gibt bessere Ergebnisse, und DeepL kann Polnisch. |
| `provider` | `none` (Text unverändert, nur mit `fromLang: "en"`), `deepl` oder `openai` |
| `corpusDir` | Pfad zu einem Git-Klon des Korpus. Gesetzt = Daten aus den Dateien statt über die API |
| `limit` | Höchstzahl an Rezepten in `rezepte-orc.json` |
| `filters.source` | `pl-wikibooks` (moderne Rezepte) oder `pl-wikisource` (historische Kochbücher, oft ohne genaue Mengen) |
| `filters.categories` | Kategorien des Korpus: `dinner`, `lunch`, `breakfast`, `snack`, `dessert`, `drink`, `other` |
| `filters.excludeDishTypes` | z. B. `preserve` (Eingemachtes), `drink`, `sauce` |
| `filters.tags` | z. B. `["vegetarian"]` – nur Rezepte, die alle Tags haben |
| `filters.maxTotalMinutes` | maximale Gesamtzeit |
| `skipWarnings` | `true` = auch Rezepte mit Hinweisen aussortieren (strenger) |

## Qualitätskontrolle (`lib/qa.mjs`)

**Fehler** – das Rezept wird nicht übernommen:
- keine Zutaten oder Schritte
- unbekannte Einheit, Menge ≤ 0 oder keine Zahl
- Übersetzung unvollständig: Titel, Zutat oder Schritt leer, oder die Anzahl stimmt nicht
- **Temperaturen nach der Übersetzung verändert** (z. B. 180 °C → 200 °C) oder in Fahrenheit

**Hinweise** – das Rezept wird übernommen und steht im Prüfbericht `qa-report.json`:
- ungewöhnliche Mengen (z. B. > 6 kg, > 30 EL), Portionen (> 40) oder Zeiten (> 24 h)
- Temperaturen außerhalb von 40–300 °C
- Zahlen in einem Schritt weichen ab (z. B. Minutenangaben)
- doppelte Zutaten, fehlende Mengen, unbekannte Zeit

Mengen, Einheiten, Zeiten und Portionen werden **nicht übersetzt**. Sie kommen unverändert aus den
strukturierten Daten des Korpus. Übersetzt werden nur die Texte.

## Lizenz (CC BY-SA 4.0) – so ist sie umgesetzt

Die Rezepte stehen unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
Jedes importierte Rezept trägt im Feld `lizenz`:

1. **Originalquelle**: Titel, Link auf die genaue Revision der Wikibooks-/Wikisource-Seite und auf das Korpus
2. **Urheber**: Credit-Zeile und Link zur Versionsgeschichte, wo alle Autorinnen und Autoren stehen
3. **Lizenz**: „CC BY-SA 4.0“ mit Link
4. **Änderungen**: strukturiert, maschinell übersetzt (mit Werkzeug), Einheiten umgestellt
5. **Weitergabe unter gleichen Bedingungen**: Die deutsche Übersetzung steht ebenfalls unter
   CC BY-SA 4.0. Das steht in der App bei jedem Rezept und in `rezepte-orc.json` unter `_lizenz`.

Die App zeigt das alles bei jedem Rezept im Kasten **„Quelle & Lizenz“** an.
`rezepte-orc.json` nicht von Hand ohne Lizenzfeld weitergeben.

Fotos aus dem Korpus werden bewusst nicht übernommen. Sie haben eigene Lizenzen und Urheber, und
KI-generierte Bilder müssten zusätzlich gekennzeichnet werden. In der App erscheint stattdessen
das Emoji der Rezeptart.

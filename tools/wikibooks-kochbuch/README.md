# Rezepte aus dem Wikibooks-Kochbuch

Lädt alle Rezepte aus dem deutschen [Wikibooks-Kochbuch](https://de.wikibooks.org/wiki/Kochbuch)
(Kategorie „Kochbuch/ Alle Rezepte“) und schreibt sie als `rezepte-wikibooks.json` in den
App-Ordner. Die App lädt die Datei zusätzlich zu `rezepte.json`. Fehlt sie, läuft alles wie bisher.

```bash
python3 tools/wikibooks-kochbuch/import.py            # neu laden (aktueller Stand der Wiki-Seiten)
python3 tools/wikibooks-kochbuch/import.py --offline  # vorhandene raw.json erneut verarbeiten
```

Es braucht nur Python 3, keine zusätzlichen Pakete und keinen Schlüssel.

## Was das Skript macht

- Es zerlegt jede Seite in Titel, Kurzbeschreibung, Zutaten (Menge, Einheit, Name, Hinweis),
  Arbeitsschritte, Zeit, Portionen, Tags (vegetarisch, vegan, schnell) und Rezeptart.
- Es sortiert aus:
  - Getränke, Soßen, Grundrezepte und Füllungen
  - Weiterleitungen
  - Seiten mit weniger als 2 erkannten Zutaten oder ohne Zubereitung

  Gründe stehen in `bericht.json`.
- Es entfernt Bilder, Tabellen, Tipps, Varianten und Weblinks. Das sind nur die Inhalte der
  Wiki-Seite, der Rezepttext selbst bleibt unverändert.
- Rezepte mit gleichem Titel wie ein eigenes Saisonovo-Rezept blendet die App aus.

## Lizenz

Die Texte stehen unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
Jedes Rezept trägt im Feld `lizenz`:

- den Link zur genauen Version der Originalseite
- die Versionsgeschichte, wo alle Autorinnen und Autoren stehen
- die Lizenz mit Link
- die vorgenommenen Änderungen

Die App zeigt das im Kasten „Quelle & Lizenz“ an. Die bearbeitete Fassung steht ebenfalls unter
CC BY-SA 4.0. Bilder aus dem Wiki werden nicht übernommen, weil sie eigene Lizenzen haben.

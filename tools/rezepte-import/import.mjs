#!/usr/bin/env node
// Saisonovo – Rezept-Import aus dem Open Recipe Corpus (CC BY-SA 4.0)
//
//   1. Rezepte über die API abrufen         (recipes.airon.app)
//   2. Automatisch übersetzen               (DeepL oder OpenAI → Deutsch)
//   3. Qualitätskontrolle                   (Zutaten, Mengen, Temperaturen, Zeiten)
//   4. Als JSON speichern                   (rezepte-orc.json im App-Ordner)
//   5. Die App liest rezepte-orc.json zusätzlich zu rezepte.json
//
// Aufruf (im Ordner tools/rezepte-import):
//   DEEPL_API_KEY=… node import.mjs                 – Import mit Einstellungen aus config.json
//   OPENAI_API_KEY=… node import.mjs --provider openai
//   node import.mjs --limit 20 --dry-run            – nur abrufen + prüfen, keine Übersetzung, nichts schreiben
//   node import.mjs --ids plwb:9356,plwb:10140      – bestimmte Rezepte
//   node import.mjs --from en --provider none       – englische Rezepte ohne Übersetzung (kein Schlüssel nötig)
//   node import.mjs --corpus ../open-recipe-corpus  – Daten aus einem Git-Klon statt über die API
//
// Bereits übersetzte Rezepte (gleiche Korpus-ID + Revision) werden nicht erneut übersetzt → spart Kosten.

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRecipes, getRecipe } from './lib/api.mjs';
import { translateRecipe } from './lib/translate.mjs';
import { checkRecipe } from './lib/qa.mjs';
import { toAppRecipe } from './lib/convert.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--dry-run') o.dryRun = true;
    else if (k === '--provider') o.provider = a[++i];
    else if (k === '--limit') o.limit = Number(a[++i]);
    else if (k === '--ids') o.ids = a[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--from') o.fromLang = a[++i];
    else if (k === '--config') o.config = a[++i];
    else if (k === '--corpus') o.corpusDir = a[++i];
    else if (k === '--help' || k === '-h') o.help = true;
    else throw new Error(`Unbekannte Option ${k}`);
  }
  return o;
}

async function writeJsonAtomic(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await writeFile(tmp, JSON.stringify(data, null, 1) + '\n');
  await rename(tmp, file);
}

async function main() {
  const o = args();
  if (o.help) { console.log((await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(1, 20).join('\n')); return; }
  const cfgFile = resolve(HERE, o.config || 'config.json');
  const cfg = JSON.parse(await readFile(cfgFile, 'utf8'));
  Object.assign(cfg, Object.fromEntries(Object.entries({ provider: o.provider, limit: o.limit, fromLang: o.fromLang, corpusDir: o.corpusDir }).filter(([, v]) => v != null)));
  if (process.env.ORC_API) cfg.api = process.env.ORC_API;
  if (!['deepl', 'openai', 'none'].includes(cfg.provider)) throw new Error('provider muss "deepl", "openai" oder "none" sein');
  if (cfg.provider === 'none' && cfg.fromLang !== 'en') throw new Error('provider "none" (ohne Übersetzung) nur mit fromLang "en" – sonst stünden polnische Texte in der App.');
  if (cfg.corpusDir) cfg.corpusDir = resolve(HERE, cfg.corpusDir);
  if (!['pl', 'en'].includes(cfg.fromLang)) throw new Error('fromLang muss "pl" oder "en" sein');
  cfg.cacheDir = resolve(HERE, cfg.cacheDir || './cache');
  const outFile = resolve(HERE, cfg.output);
  const reportFile = resolve(HERE, cfg.report);

  if (!o.dryRun && cfg.provider !== 'none') {
    const key = cfg.provider === 'openai' ? 'OPENAI_API_KEY' : 'DEEPL_API_KEY';
    if (!process.env[key]) throw new Error(`${key} fehlt. Beispiel: ${key}=dein-schlüssel node import.mjs  (oder --dry-run zum Testen ohne Übersetzung)`);
  }

  // Vorhandene Übersetzungen weiterverwenden
  const alt = new Map();
  try {
    for (const r of JSON.parse(await readFile(outFile, 'utf8')).rezepte || []) alt.set(r.lizenz?.korpusId + '@' + r.lizenz?.quelle, r);
  } catch { /* erste Ausführung */ }

  console.log(`① Rezepte abrufen (${cfg.corpusDir ? 'lokaler Korpus ' + cfg.corpusDir : cfg.api}, Sprache ${cfg.fromLang}${cfg.provider === 'none' ? ', ohne Übersetzung' : ''}) …`);
  const ids = o.ids || await listRecipes(cfg);
  console.log(`   ${ids.length} passende Rezepte gefunden, verarbeite bis zu ${cfg.limit}.`);

  const fertig = [], bericht = { erstellt: new Date().toISOString(), provider: cfg.provider, fromLang: cfg.fromLang, uebernommen: 0, abgelehnt: [], warnungen: [] };
  let uebersetzt = 0, wiederverwendet = 0;

  for (const id of ids) {
    if (fertig.length >= cfg.limit) break;
    let src;
    try { src = await getRecipe(cfg, id); }
    catch (e) { bericht.abgelehnt.push({ id, gruende: [e.message] }); console.warn(`   ✗ ${id}: ${e.message}`); continue; }

    // ③ Vorprüfung am Original (spart Übersetzungskosten für unbrauchbare Rezepte)
    const vor = checkRecipe(src, null);
    if (vor.fehler.length) { bericht.abgelehnt.push({ id, name: src.name, gruende: vor.fehler }); console.warn(`   ✗ ${src.name}: ${vor.fehler.join('; ')}`); continue; }
    if (cfg.skipWarnings && vor.warnungen.length) { bericht.abgelehnt.push({ id, name: src.name, gruende: vor.warnungen }); continue; }
    if (o.dryRun) { fertig.push({ id, name: src.name }); if (vor.warnungen.length) bericht.warnungen.push({ id, name: src.name, warnungen: vor.warnungen }); console.log(`   ✓ ${src.name}${vor.warnungen.length ? '  ⚠ ' + vor.warnungen.join('; ') : ''}`); continue; }

    const quelle = src.attribution?.revision_url || src.attribution?.url || null;
    const vorhanden = alt.get(src.id + '@' + quelle);
    if (vorhanden && vorhanden.lizenz?.maschinell && vorhanden._provider === cfg.provider) { fertig.push(vorhanden); wiederverwendet++; continue; }

    // ② Übersetzen
    let de;
    try { de = await translateRecipe(src, cfg); uebersetzt++; }
    catch (e) {
      if (/fehlt|Kontingent|401|403/.test(e.message)) throw e;          // Schlüssel/Guthaben-Problem → abbrechen
      bericht.abgelehnt.push({ id, name: src.name, gruende: ['Übersetzung: ' + e.message] }); console.warn(`   ✗ ${src.name}: ${e.message}`); continue;
    }

    // ③ Prüfung nach Übersetzung
    const qa = checkRecipe(src, de);
    if (qa.fehler.length) { bericht.abgelehnt.push({ id, name: src.name, titel: de.name, gruende: qa.fehler }); console.warn(`   ✗ ${de.name}: ${qa.fehler.join('; ')}`); continue; }
    if (cfg.skipWarnings && qa.warnungen.length) { bericht.abgelehnt.push({ id, name: src.name, titel: de.name, gruende: qa.warnungen }); continue; }
    if (qa.warnungen.length) bericht.warnungen.push({ id, titel: de.name, warnungen: qa.warnungen });

    const r = toAppRecipe(src, de, cfg);
    r._provider = cfg.provider;
    fertig.push(r);
    console.log(`   ✓ ${r.titel}${qa.warnungen.length ? '  ⚠ ' + qa.warnungen.length + ' Hinweis(e)' : ''}`);
  }

  bericht.uebernommen = fertig.length;
  await writeJsonAtomic(reportFile, bericht);
  if (o.dryRun) { console.log(`\nTestlauf: ${fertig.length} Rezepte wären übernommen worden, ${bericht.abgelehnt.length} abgelehnt. Bericht: ${reportFile}`); return; }

  // ④ Speichern
  await writeJsonAtomic(outFile, {
    _hinweis: 'Automatisch erzeugt von tools/rezepte-import/import.mjs – nicht von Hand bearbeiten, Änderungen werden beim nächsten Import überschrieben.',
    _lizenz: {
      text: `Die Rezepte in dieser Datei stammen aus dem Open Recipe Corpus (Wikibooks/Wikisource) und wurden ${cfg.provider === 'none' ? 'in der englischen Fassung des Korpus (maschinell aus dem Polnischen übersetzt) übernommen' : 'strukturiert sowie maschinell ins Deutsche übersetzt'}. Sie stehen – wie die Originale – unter der Lizenz Creative Commons Namensnennung – Weitergabe unter gleichen Bedingungen 4.0 International (CC BY-SA 4.0). Die Urheber, die Originalquelle und die vorgenommenen Änderungen stehen bei jedem Rezept im Feld "lizenz".`,
      name: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
      rechtstext: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.de',
      quelle: 'https://github.com/Rippy1911/open-recipe-corpus',
    },
    erstellt: new Date().toISOString(),
    rezepte: o.ids ? [...[...alt.values()].filter(r => !o.ids.includes(r.lizenz?.korpusId)), ...fertig] : fertig,
  });
  if (o.ids) console.log(`\n   (--ids: übrige ${alt.size} vorhandene Rezepte bleiben erhalten)`);
  console.log(`\n④ ${fertig.length} Rezepte verarbeitet und gespeichert → ${outFile}`);
  console.log(`   ${cfg.provider === 'none' ? 'neu übernommen' : 'neu übersetzt'}: ${uebersetzt}, aus vorherigem Lauf übernommen: ${wiederverwendet}, abgelehnt: ${bericht.abgelehnt.length}, mit Hinweisen: ${bericht.warnungen.length}`);
  console.log(`   Prüfbericht: ${reportFile}`);
}

main().catch(e => { console.error('\nFehler: ' + e.message); process.exit(1); });

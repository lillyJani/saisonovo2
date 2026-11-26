// Open Recipe Corpus – REST-API (https://recipes.airon.app, ohne Schlüssel, 10 Anfragen / 10 s)
// Antworten werden im Cache-Ordner gespeichert: ein erneuter Lauf fragt nur Neues ab.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const UA = 'Saisonovo-Rezeptimport/1.0 (+https://lillyjani.github.io/saisonovo/)';
let last = 0;

async function throttle() {
  // höchstens 1 Anfrage pro 1,1 s → sicher unter dem Limit von 10 pro 10 s
  const wait = last + (process.env.ORC_FAST ? 0 : 1100) - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
}

export async function getJson(url, { cacheDir, retries = 4 } = {}) {
  const key = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) + '.json';
  if (cacheDir) {
    try { return JSON.parse(await readFile(join(cacheDir, key), 'utf8')); } catch { /* nicht im Cache */ }
  }
  for (let versuch = 0; ; versuch++) {
    await throttle();
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (versuch < retries) { await new Promise(r => setTimeout(r, 2000 * (versuch + 1))); continue; }
      throw new Error(`Rezept-API nicht erreichbar: ${e.message}`);
    }
    if (res.status === 429 && versuch < retries) {
      const s = Number(res.headers.get('retry-after')) || 10;
      console.warn(`  … Limit erreicht, warte ${s} s`);
      await new Promise(r => setTimeout(r, s * 1000));
      continue;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Rezept-API ${res.status}: ${data?.error?.message || res.statusText} (${url})`);
    if (cacheDir) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, key), JSON.stringify(data));
    }
    return data;
  }
}

/* ── Offline-Modus: Daten direkt aus einem Klon von github.com/Rippy1911/open-recipe-corpus ──
   (config.corpusDir oder --corpus <ordner>). Liefert dieselbe Form wie die REST-API. */
let _local = null;
function local(cfg) {
  if (_local) return _local;
  const dir = resolve(cfg.corpusDir);
  const jsonl = f => readFileSync(join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const rec = new Map(jsonl('data/recipes.jsonl').map(r => [r.id, r]));
  const txt = new Map(jsonl(`data/text/${cfg.fromLang}.jsonl`).map(r => [r.id, r]));
  _local = { rec, txt };
  return _local;
}
function localRecipe(cfg, id) {
  const { rec, txt } = local(cfg);
  const r = rec.get(id), t = txt.get(id);
  if (!r || !t) return null;
  const p = r.provenance || {};
  const origin = p.url ? new URL(p.url).origin : null;
  const mt = !!t.machine_translated;
  return {
    id, lang: cfg.fromLang, name: t.name, summary: t.summary, machine_translated: mt, translated_from: t.translated_from || null,
    category: r.category, dish_type: r.dish_type, cuisine: r.cuisine, servings: r.servings, time_min: r.time_min,
    tags: r.tags || [], allergens: r.allergens || [], photo: null, source_lang: r.source_lang,
    attribution: {
      title: p.title, source: p.source, url: p.url, revision: p.revision,
      revision_url: origin && p.revision ? `${origin}/w/index.php?oldid=${p.revision}` : p.url,
      history_url: p.history_url, credit: p.attribution, source_license: p.source_license,
      license: p.license, license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      changes: [p.changes, mt ? `machine-translated from ${t.translated_from || r.source_lang}` : null].filter(Boolean).join('; '),
      machine_translated: mt, based_on: p.based_on || null,
    },
    ingredients: (r.ingredients || []).map((z, i) => ({
      name: t.ingredients?.[i]?.name, qty: z.qty, unit: z.unit,
      ...(t.ingredients?.[i]?.note ? { note: t.ingredients[i].note } : {}),
    })),
    steps: t.steps || [],
  };
}

/** Liste passender Rezept-IDs über alle gewünschten Kategorien (mit Seitenweiterschaltung). */
export async function listRecipes(cfg) {
  if (cfg.corpusDir) {
    const f = cfg.filters || {};
    const { rec, txt } = local(cfg);
    return [...rec.values()].filter(r => {
      if (!txt.has(r.id)) return false;
      if (f.source && r.provenance?.source !== f.source) return false;
      if (f.categories?.length && !f.categories.includes(r.category)) return false;
      if ((f.excludeDishTypes || []).includes(r.dish_type)) return false;
      if (f.tags?.length && !f.tags.every(t => (r.tags || []).includes(t))) return false;
      if (f.maxTotalMinutes) {
        const t = r.time_min;
        if (!t || (t.prep == null && t.cook == null) || (t.prep || 0) + (t.cook || 0) > f.maxTotalMinutes) return false;
      }
      return true;
    }).map(r => r.id);
  }
  const f = cfg.filters || {};
  const ids = new Map();
  const kategorien = f.categories?.length ? f.categories : [null];
  for (const cat of kategorien) {
    let cursor = null;
    do {
      const q = new URLSearchParams({ lang: cfg.fromLang, limit: '50' });
      if (f.source) q.set('source', f.source);
      if (cat) q.set('category', cat);
      if (f.tags?.length) q.set('tags', f.tags.join(','));
      if (f.maxTotalMinutes) q.set('max_total_minutes', String(f.maxTotalMinutes));
      if (cursor) q.set('cursor', cursor);
      const page = await getJson(`${cfg.api}/v1/recipes?${q}`, { cacheDir: cfg.cacheDir });
      for (const r of page.results || []) {
        if ((f.excludeDishTypes || []).includes(r.dish_type)) continue;
        if (!ids.has(r.id)) ids.set(r.id, r);
      }
      cursor = page.next_cursor || null;
    } while (cursor && ids.size < cfg.limit * 3);
  }
  return [...ids.keys()];
}

export async function getRecipe(cfg, id) {
  if (cfg.corpusDir) {
    const r = localRecipe(cfg, id);
    if (!r) throw new Error(`Rezept ${id} nicht im Korpus (Sprache ${cfg.fromLang})`);
    return r;
  }
  const data = await getJson(`${cfg.api}/v1/recipes/${encodeURIComponent(id)}?lang=${cfg.fromLang}`, { cacheDir: cfg.cacheDir });
  if (!data?.recipe) throw new Error(`Rezept ${id} ohne Inhalt`);
  return data.recipe;
}

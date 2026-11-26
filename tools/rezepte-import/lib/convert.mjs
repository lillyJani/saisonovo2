// Umwandlung eines (übersetzten) Korpus-Rezepts ins Saisonovo-Rezeptformat (rezepte.json)
import { UNITS } from './qa.mjs';

const TYP = {
  main: 'hauptgericht', side: 'hauptgericht', soup: 'suppe', salad: 'salat',
  breakfast: 'fruehstueck', snack: 'fruehstueck', bread: 'fruehstueck',
  dessert: 'dessert', cake: 'dessert', cookie: 'dessert',
};
const EMOJI = { hauptgericht: '🍽️', suppe: '🍲', salat: '🥗', fruehstueck: '🥣', dessert: '🍰' };
const SPRACHE = { pl: 'Polnischen', en: 'Englischen' };
const SPRACHE_NAME = { pl: 'Polnisch', en: 'Englisch' };

// Änderungsvermerk des Korpus auf Deutsch (unbekannte Vermerke bleiben im Original erhalten)
function aenderungDe(c) {
  const mt = String(c).match(/;\s*machine-translated from (\w+)$/i);
  const t = String(c).replace(/;\s*machine-translated from \w+$/i, '');
  const zusatz = mt ? `, maschinell aus dem ${SPRACHE[mt[1]] || mt[1]} ins Englische übersetzt` : '';
  return aenderungDeOhne(t) + zusatz;
}
function aenderungDeOhne(t) {
  if (/^structured into fields and edited for clarity$/i.test(t)) return 'in Felder gegliedert und sprachlich geglättet';
  const m = t.match(/^modernised:\s*(.+)$/i);
  if (m) return `Sprache und historische Maße modernisiert (Originalvermerk: „${m[1].replace(/\.$/, '')}“)`;
  return t;
}

function typVon(src) {
  if (TYP[src.dish_type]) return TYP[src.dish_type];
  if (src.category === 'dessert') return 'dessert';
  if (src.category === 'breakfast' || src.category === 'snack') return 'fruehstueck';
  return 'hauptgericht';
}

// Einheiten für Rezepte, die auf Englisch übernommen werden
const UNITS_EN = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', pcs: 'pc', tsp: 'tsp', tbsp: 'tbsp', pinch: 'pinch', clove: 'clove', slice: 'slice', bunch: 'bunch', to_taste: null };

export function toAppRecipe(src, de, { fromLang, provider }) {
  const original = provider === 'none';              // Text unverändert aus dem Korpus (keine eigene Übersetzung)
  const units = original && fromLang === 'en' ? UNITS_EN : UNITS;
  const tags = new Set();
  const st = src.tags || [];
  if (st.includes('vegan')) { tags.add('vegan'); tags.add('vegetarisch'); }
  if (st.includes('vegetarian')) tags.add('vegetarisch');
  if (st.includes('gluten_free')) tags.add('glutenfrei');
  const t = src.time_min || {};
  const zeit = t.prep == null && t.cook == null ? null : (t.prep || 0) + (t.cook || 0);
  if (st.includes('quick') || (zeit && zeit <= 30)) tags.add('schnell');

  const typ = typVon(src);
  const a = src.attribution || {};
  const werkzeug = provider === 'openai' ? 'OpenAI' : 'DeepL';
  const aenderungen = original
    ? [a.changes ? `Open Recipe Corpus: ${aenderungDe(a.changes)}` : null,
       'für Saisonovo ins App-Format übernommen (Text unverändert)'].filter(Boolean).join('; ')
    : [a.changes ? `Open Recipe Corpus: ${aenderungDe(a.changes)}` : null,
       `maschinell aus dem ${SPRACHE[fromLang] || fromLang} ins Deutsche übersetzt (${werkzeug})`,
       'Einheiten ins deutsche Format übertragen'].filter(Boolean).join('; ');

  return {
    id: 'orc-' + src.id.replace(/[^a-z0-9]+/gi, '-'),
    titel: de.name.trim(),
    emoji: EMOJI[typ],
    beschreibung: (de.summary || '').trim(),
    zeit,
    portionen: src.servings || null,
    tags: [...tags],
    typ,
    zutaten: (src.ingredients || []).map((z, i) => {
      const d = de.ingredients[i] || {};
      const out = { name: d.name.trim(), menge: z.unit === 'to_taste' ? null : z.qty, einheit: units[z.unit] };
      const nachGeschmack = original && fromLang === 'en' ? 'to taste' : 'nach Geschmack';
      const hinweis = [z.unit === 'to_taste' ? nachGeschmack : null, d.note?.trim() || null].filter(Boolean).join(', ');
      if (hinweis) out.hinweis = hinweis;
      return out;
    }),
    schritte: de.steps.map(s => s.trim()),
    // Fotos werden nicht übernommen (eigene Lizenz/Urheber pro Foto, KI-Bilder wären zu kennzeichnen)
    // ── Namensnennung nach CC BY-SA 4.0 ──
    lizenz: {
      name: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
      titel: a.title || src.name,
      urheber: a.credit || null,
      quelle: a.revision_url || a.url || null,
      quelleSeite: a.url || null,
      versionen: a.history_url || null,
      korpus: 'Open Recipe Corpus',
      korpusUrl: 'https://github.com/Rippy1911/open-recipe-corpus',
      korpusId: src.id,
      originalsprache: src.source_lang || fromLang,
      sprache: original ? fromLang : 'de',          // Sprache des Rezepttexts in der App
      aenderungen,
      maschinell: original ? !!(src.machine_translated || src.attribution?.machine_translated) : true,
      uebersetzer: original ? (src.machine_translated ? 'Open Recipe Corpus' : null) : (provider === 'openai' ? 'OpenAI' : 'DeepL'),
    },
  };
}

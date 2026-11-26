// Qualitätskontrolle: Zutaten, Mengen, Temperaturen, Zeiten und Vollständigkeit der Übersetzung.
// Ergebnis: { fehler: [...], warnungen: [...] }. Rezepte mit Fehlern werden NICHT übernommen,
// Rezepte mit Warnungen nur, wenn config.skipWarnings = false (Standard) – sie stehen dann im Bericht.

export const UNITS = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l', pcs: 'Stück', tsp: 'TL', tbsp: 'EL',
  pinch: 'Prise', clove: 'Zehe', slice: 'Scheibe', bunch: 'Bund', to_taste: null,
};

// Plausible Höchstmengen pro Einheit (für ein Rezept, nicht pro Portion)
const MAX = { g: 6000, kg: 8, ml: 6000, l: 8, pcs: 60, tsp: 20, tbsp: 30, pinch: 6, clove: 30, slice: 40, bunch: 6 };

const NUM_RE = /\d+(?:[.,]\d+)?/g;
// Temperaturen: "180 °C", "180°", "180 stopni", "180 Grad", "180 degrees"
const TEMP_RE = /(?<![\d.,])(\d{2,3})\s*(?:°\s*C?|stopni|stopniach|grad|degrees?)/gi;

export function temperatures(text) {
  return [...String(text || '').matchAll(TEMP_RE)].map(m => Number(m[1]));
}

function numbers(text) {
  return (String(text || '').match(NUM_RE) || []).map(n => Number(n.replace(',', '.'))).sort((a, b) => a - b);
}

export function checkRecipe(src, de) {
  const fehler = [], warnungen = [];
  const ing = src.ingredients || [];

  // ── Struktur ──
  if (!ing.length) fehler.push('keine Zutaten');
  if (!(src.steps || []).length) fehler.push('keine Arbeitsschritte');
  if (de) {
    if (!de.name?.trim()) fehler.push('Titel fehlt nach Übersetzung');
    if (de.ingredients.length !== ing.length) fehler.push('Zutatenzahl stimmt nach Übersetzung nicht');
    if (de.steps.length !== (src.steps || []).length) fehler.push('Schrittzahl stimmt nach Übersetzung nicht');
    de.ingredients.forEach((z, i) => { if (!z.name?.trim()) fehler.push(`Zutat ${i + 1}: Name fehlt nach Übersetzung`); });
    de.steps.forEach((s, i) => { if (!s?.trim()) fehler.push(`Schritt ${i + 1}: leer nach Übersetzung`); });
  }

  // ── Zutaten & Mengen ──
  ing.forEach((z, i) => {
    const label = `Zutat ${i + 1} (${z.name})`;
    if (!(z.unit in UNITS)) { fehler.push(`${label}: unbekannte Einheit "${z.unit}"`); return; }
    if (z.unit === 'to_taste') {
      if (z.qty != null) warnungen.push(`${label}: Menge bei "nach Geschmack"`);
      return;
    }
    if (z.qty == null) { warnungen.push(`${label}: Menge fehlt`); return; }
    if (typeof z.qty !== 'number' || !isFinite(z.qty) || z.qty <= 0) { fehler.push(`${label}: ungültige Menge ${z.qty}`); return; }
    if (z.qty > MAX[z.unit]) warnungen.push(`${label}: ungewöhnlich viel (${z.qty} ${z.unit})`);
    if ((z.unit === 'g' || z.unit === 'ml') && z.qty < 1) warnungen.push(`${label}: sehr kleine Menge (${z.qty} ${z.unit})`);
  });
  const namen = ing.map(z => (z.name || '').toLowerCase().trim());
  const doppelt = namen.filter((n, i) => n && namen.indexOf(n) !== i);
  if (doppelt.length) warnungen.push(`Zutat doppelt: ${[...new Set(doppelt)].join(', ')}`);

  // ── Portionen & Zeiten ──
  if (src.servings != null && (src.servings < 1 || src.servings > 40)) warnungen.push(`ungewöhnliche Portionenzahl ${src.servings}`);
  const t = src.time_min || {};
  const total = (t.prep || 0) + (t.cook || 0);
  if (t.prep == null && t.cook == null) warnungen.push('Zeit unbekannt');
  else if (total <= 0 || total > 24 * 60) warnungen.push(`ungewöhnliche Zeit ${total} Min.`);

  // ── Temperaturen (Original und Übersetzung) ──
  const tSrc = (src.steps || []).flatMap(temperatures);
  tSrc.forEach(c => { if (c < 40 || c > 300) warnungen.push(`ungewöhnliche Temperatur ${c} °C im Original`); });
  if (de) {
    const tDe = de.steps.flatMap(temperatures);
    const a = [...tSrc].sort((x, y) => x - y).join(','), b = [...tDe].sort((x, y) => x - y).join(',');
    if (a !== b) fehler.push(`Temperaturen nach Übersetzung verändert (Original: ${a || '–'} / Deutsch: ${b || '–'})`);
    tDe.forEach(c => { if (c < 40 || c > 300) warnungen.push(`ungewöhnliche Temperatur ${c} °C`); });
    if (/°\s*F|fahrenheit/i.test(de.steps.join(' '))) fehler.push('Temperatur in Fahrenheit');

    // Alle Zahlen eines Schritts (Minuten, Mengen, °C) müssen erhalten bleiben
    (src.steps || []).forEach((s, i) => {
      const n1 = numbers(s).join(','), n2 = numbers(de.steps[i]).join(',');
      if (n1 !== n2) warnungen.push(`Schritt ${i + 1}: Zahlen weichen ab (${n1 || '–'} → ${n2 || '–'})`);
    });
  }
  return { fehler, warnungen };
}

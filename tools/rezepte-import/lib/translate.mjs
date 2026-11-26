// Übersetzung ins Deutsche: DeepL (empfohlen) oder OpenAI. Schlüssel nur aus Umgebungsvariablen.
//   DEEPL_API_KEY   – Free-Schlüssel enden auf ":fx" und nutzen automatisch api-free.deepl.com
//   OPENAI_API_KEY  – Modell über config.openaiModel bzw. OPENAI_MODEL
// Übersetzt werden nur Texte (Name, Beschreibung, Zutatennamen, Hinweise, Schritte).
// Mengen, Einheiten, Zeiten und Portionen kommen unverändert aus den strukturierten Daten.

const LANG = { pl: 'PL', en: 'EN' };

/** Texte eines Rezepts als flache Liste (Reihenfolge wird beim Zurückschreiben wieder genutzt). */
export function segments(r) {
  const s = [r.name || '', r.summary || ''];
  for (const i of r.ingredients || []) s.push(i.name || '', i.note || '');
  for (const st of r.steps || []) s.push(st || '');
  return s;
}

export function applySegments(r, t) {
  let k = 0;
  const out = { name: t[k++], summary: t[k++], ingredients: [], steps: [] };
  for (let i = 0; i < (r.ingredients || []).length; i++) out.ingredients.push({ name: t[k++], note: t[k++] });
  for (let i = 0; i < (r.steps || []).length; i++) out.steps.push(t[k++]);
  return out;
}

async function deepl(texts, from, context) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DEEPL_API_KEY fehlt (Umgebungsvariable).');
  const base = process.env.DEEPL_BASE_URL || (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
  const out = new Array(texts.length).fill('');
  const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter(i => i >= 0);
  for (let a = 0; a < idx.length; a += 50) {            // DeepL: max. 50 Texte pro Anfrage
    const part = idx.slice(a, a + 50);
    for (let versuch = 0; ; versuch++) {
      const res = await fetch(`${base}/v2/translate`, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: part.map(i => texts[i]),
          source_lang: LANG[from] || from.toUpperCase(),
          target_lang: 'DE',
          formality: 'prefer_less',                     // "du" statt "Sie"
          context,                                      // Rezepttitel als Kontext (wird nicht übersetzt/berechnet)
          preserve_formatting: true,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if ((res.status === 429 || res.status >= 500) && versuch < 4) { await new Promise(r => setTimeout(r, 3000 * (versuch + 1))); continue; }
      if (res.status === 456) throw new Error('DeepL: Zeichenkontingent aufgebraucht.');
      if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
      const d = await res.json();
      d.translations.forEach((t, j) => { out[part[j]] = t.text; });
      break;
    }
  }
  return out;
}

async function openai(texts, from, context, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY fehlt (Umgebungsvariable).');
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const sprache = { pl: 'Polnisch', en: 'Englisch' }[from] || from;
  const prompt = `Übersetze die folgenden Texte eines Kochrezepts ("${context}") aus dem ${sprache} ins Deutsche.
Regeln:
- Gib GENAU so viele Einträge zurück, in derselben Reihenfolge. Leere Einträge bleiben leer.
- Alle Zahlen, Mengen, Temperaturen (°C) und Zeiten exakt übernehmen, nichts umrechnen, nichts weglassen, nichts hinzufügen.
- Zutatennamen so, wie sie in deutschen Supermärkten heißen (z. B. "Möhren", "Lauch", "Schmand").
- Arbeitsschritte im Imperativ mit "du" (z. B. "Schneide die Zwiebel …").
Antworte nur mit JSON: {"t": ["…", "…"]}`;
  for (let versuch = 0; ; versuch++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || model || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify({ t: texts }) }],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if ((res.status === 429 || res.status >= 500) && versuch < 4) { await new Promise(r => setTimeout(r, 5000 * (versuch + 1))); continue; }
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const d = await res.json();
    const t = JSON.parse(d.choices?.[0]?.message?.content || '{}').t;
    if (!Array.isArray(t) || t.length !== texts.length) {
      if (versuch < 2) continue;
      throw new Error('OpenAI hat eine falsche Anzahl an Texten geliefert.');
    }
    return t.map(x => String(x ?? ''));
  }
}

export async function translateRecipe(r, cfg) {
  const texts = segments(r);
  if (cfg.provider === 'none') return applySegments(r, texts);   // ohne Übersetzung (z. B. englische Texte)
  const t = cfg.provider === 'openai'
    ? await openai(texts, cfg.fromLang, r.name, cfg.openaiModel)
    : await deepl(texts, cfg.fromLang, r.name);
  return applySegments(r, t);
}

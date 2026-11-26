<?php
declare(strict_types=1);

namespace Saisonovo\Support;

/**
 * Abgleich eines gescannten Produkts (Name, Marke, Menge aus Open Food Facts) mit
 * Supermarkt-Artikeln, die keine EAN mitliefern (Pepesto, Apify).
 *
 * Bewertung 0…1 aus: Wortüberschneidung im Namen, Marke vorhanden, Packungsgröße passt.
 * Passt die Packungsgröße eindeutig NICHT (z. B. 400 g vs. 750 g), wird der Artikel verworfen –
 * lieber kein Preis als ein falscher.
 */
final class TextMatch
{
    private const STOP = ['und', 'mit', 'der', 'die', 'das', 'von', 'fuer', 'aus', 'ohne', 'im', 'in', 'zum', 'zur',
        'bio', 'ja', 'rewe', 'beste', 'wahl', 'gut', 'guenstig', 'g', 'kg', 'ml', 'l', 'stueck', 'st', 'packung', 'pack', 'x'];

    public static function normalize(string $s): string
    {
        $s = mb_strtolower($s, 'UTF-8');
        $s = strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', 'é' => 'e', 'è' => 'e', 'à' => 'a']);
        $s = preg_replace('/[^a-z0-9,.\s]/', ' ', $s) ?? '';
        return trim(preg_replace('/\s+/', ' ', $s) ?? '');
    }

    /** @return list<string> */
    public static function tokens(string $s): array
    {
        $s = preg_replace('/\d+([.,]\d+)?\s*(kg|g|gr|ml|l|cl|stueck|st|x)\b/', ' ', self::normalize($s)) ?? '';
        $out = [];
        foreach (preg_split('/[\s,.]+/', $s) ?: [] as $t) {
            if (strlen($t) >= 3 && !in_array($t, self::STOP, true) && !ctype_digit($t)) {
                $out[] = $t;
            }
        }
        return array_values(array_unique($out));
    }

    /** Packungsgröße in Gramm bzw. Milliliter (Liter→ml), null wenn unbekannt. */
    public static function quantity(?string $s): ?array
    {
        if (!$s) {
            return null;
        }
        $n = self::normalize($s);
        if (preg_match('/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|cl|l)\b/', $n, $m)) {
            $v = (float) str_replace(',', '.', $m[2]) * (int) $m[1];
            $u = $m[3];
        } elseif (preg_match('/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|cl|l)\b/', $n, $m)) {
            $v = (float) str_replace(',', '.', $m[1]);
            $u = $m[2];
        } else {
            return null;
        }
        return match ($u) {
            'kg' => ['g', $v * 1000], 'g', 'gr' => ['g', $v],
            'l' => ['ml', $v * 1000], 'cl' => ['ml', $v * 10], default => ['ml', $v],
        };
    }

    /**
     * @param array{name:string, brand:?string, quantity:?string} $wanted
     * @return float 0…1 (0 = verworfen)
     */
    public static function score(array $wanted, string $candidateName, ?string $candidateQty = null): float
    {
        $want = self::tokens($wanted['name']);
        $cand = self::tokens($candidateName . ' ' . ($candidateQty ?? ''));
        if (!$want || !$cand) {
            return 0.0;
        }
        // Wortüberschneidung, auch bei zusammengesetzten Wörtern (pfefferminz ⊂ pfefferminztee)
        $hits = 0;
        foreach ($want as $w) {
            foreach ($cand as $c) {
                if ($w === $c || (strlen($w) >= 5 && (str_contains($c, $w) || str_contains($w, $c) && strlen($c) >= 5))) {
                    $hits++;
                    break;
                }
            }
        }
        $nameScore = $hits / count($want);
        if ($nameScore < 0.5) {
            return 0.0;
        }

        $score = 0.6 * $nameScore;

        // Marke: bei Markenprodukten muss sie im Artikelnamen vorkommen
        $brand = trim(explode(',', (string) ($wanted['brand'] ?? ''))[0]);
        if ($brand !== '') {
            $bt = self::tokens($brand);
            $candNorm = self::normalize($candidateName);
            $brandHit = $bt && count(array_filter($bt, static fn ($t) => str_contains($candNorm, $t))) > 0;
            if (!$brandHit) {
                return 0.0;
            }
            $score += 0.25;
        } else {
            $score += 0.1;
        }

        // Packungsgröße
        $qa = self::quantity($wanted['quantity'] ?? null);
        $qb = self::quantity($candidateQty) ?? self::quantity($candidateName);
        if ($qa && $qb) {
            if ($qa[0] !== $qb[0] || abs($qa[1] - $qb[1]) > max(5, 0.05 * $qa[1])) {
                return 0.0;   // andere Packungsgröße → anderer Preis
            }
            $score += 0.15;
        }
        return round(min(1.0, $score), 3);
    }
}

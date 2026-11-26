<?php
declare(strict_types=1);

namespace Saisonovo\Support;

use Saisonovo\Support\Exception\InvalidEanException;

/**
 * Prüft und normalisiert EAN/GTIN-Codes (GTIN-8, UPC-A/GTIN-12, EAN-13, GTIN-14).
 */
final class Ean
{
    /**
     * Bereinigt die Eingabe (Leerzeichen, Bindestriche), prüft Länge und Prüfziffer.
     * UPC-A (12 Stellen) wird mit führender 0 zu EAN-13 ergänzt – so speichert auch Open Food Facts.
     *
     * @throws InvalidEanException
     */
    public static function normalize(string $raw): string
    {
        $code = preg_replace('/[\s\-]/', '', trim($raw)) ?? '';
        if ($code === '' || !ctype_digit($code)) {
            throw new InvalidEanException('Die EAN darf nur aus Ziffern bestehen.');
        }
        $len = strlen($code);
        if (!in_array($len, [8, 12, 13, 14], true)) {
            throw new InvalidEanException("Eine EAN hat 8, 12, 13 oder 14 Stellen – erhalten: {$len}.");
        }
        if (!self::checksumValid($code)) {
            throw new InvalidEanException('Die Prüfziffer der EAN stimmt nicht – bitte erneut scannen.');
        }
        if ($len === 12) {
            $code = '0' . $code;
        }
        return $code;
    }

    public static function checksumValid(string $code): bool
    {
        $digits = array_map('intval', str_split($code));
        $check = array_pop($digits);
        $sum = 0;
        // Von rechts: abwechselnd Gewicht 3 und 1
        foreach (array_reverse($digits) as $i => $d) {
            $sum += $d * ($i % 2 === 0 ? 3 : 1);
        }
        return (10 - $sum % 10) % 10 === $check;
    }
}

<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Support\Exception\SourceException;

/**
 * Quelle für Produkt-Stammdaten (Name, Marke, Nachhaltigkeit, Siegel, Nährwerte, Zutaten).
 */
interface ProductInfoSource
{
    /** Kurzname der Quelle, z. B. "openfoodfacts" – landet in _meta.sources */
    public function name(): string;

    /**
     * @return array<string,mixed>|null  Produkt im Open-Food-Facts-Feldformat, oder null wenn unbekannt
     * @throws SourceException  bei Netzwerkfehlern/Timeouts
     */
    public function fetchProduct(string $ean): ?array;
}

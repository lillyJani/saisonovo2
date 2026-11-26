<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Support\Exception\SourceException;

/**
 * Quelle für Preisdaten. Weitere Anbieter (REWE, ALDI/LIDL, …) werden als eigene Klasse
 * angelegt und in scan.php registriert – ProductService und App bleiben unverändert.
 *
 * Jeder Preis wird im gemeinsamen Format geliefert:
 * [
 *   'source'        => 'open_prices',      // = name()
 *   'source_id'     => '360319',           // ID beim Anbieter (für Deduplizierung)
 *   'price'         => 4.05,
 *   'currency'      => 'EUR',
 *   'date'          => '2026-11-05',       // Datum der Beobachtung (Kassenbon/Preisschild/Katalog)
 *   'is_discounted' => false,
 *   'price_without_discount' => null,
 *   'price_per'     => null,               // z. B. 'KILOGRAM' bei losen Waren
 *   'store'         => 'REWE',             // Markt/Kette
 *   'city'          => 'Berlin', 'postcode' => '10115', 'country_code' => 'DE',
 *   'kind'          => 'receipt' | 'price_tag' | 'catalog' | 'online',
 * ]
 */
interface PriceSource
{
    public function name(): string;

    /** false, wenn die Quelle deaktiviert oder nicht konfiguriert ist (z. B. kein API-Schlüssel) */
    public function isEnabled(): bool;

    /**
     * @param array<string,mixed> $context  Zusatzinfos, z. B. ['product_name' => …, 'brands' => …, 'postcode' => …]
     * @return list<array<string,mixed>>
     * @throws SourceException
     */
    public function fetchPrices(string $ean, array $context = []): array;
}

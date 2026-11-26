<?php
declare(strict_types=1);

namespace Saisonovo\Repository;

/**
 * Speicher für angereicherte Produktdatensätze (Cache).
 *
 * Die App-Logik (ProductService) kennt nur diese Schnittstelle. Für eine spätere Migration
 * auf SQLite/MySQL genügt eine weitere Implementierung, z. B. PdoProductRepository, die
 * denselben Datensatz (siehe README, "Cache-Format") als JSON-Spalte oder in Tabellen ablegt.
 */
interface ProductRepository
{
    /** @return array<string,mixed>|null  Datensatz oder null, wenn die EAN unbekannt ist */
    public function find(string $ean): ?array;

    /** @param array<string,mixed> $record */
    public function save(string $ean, array $record): void;

    public function delete(string $ean): void;

    /** @return iterable<string,array<string,mixed>>  alle Datensätze (für Migration/Bulk-Export) */
    public function all(): iterable;
}

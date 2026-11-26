<?php
declare(strict_types=1);

namespace Saisonovo\Service;

use Saisonovo\Repository\ProductRepository;
use Saisonovo\Source\PriceSource;
use Saisonovo\Source\ProductInfoSource;
use Saisonovo\Support\Clock;
use Saisonovo\Support\Ean;
use Saisonovo\Support\Exception\ProductNotFoundException;
use Saisonovo\Support\Exception\SourceException;

/**
 * Ablauf eines Scans:
 *  1. EAN prüfen.
 *  2. Lokalen Cache lesen.
 *  3. Stammdaten (OFF) nur neu laden, wenn sie fehlen oder älter als TTL sind;
 *     Preise getrennt davon, wenn sie älter als 24 h sind.
 *  4. Ergebnisse zusammenführen, Cache schreiben, Antwort liefern.
 *  Fällt eine Quelle aus, wird – falls vorhanden – der ältere Cache-Stand geliefert (stale = true).
 *
 * Kennt nur die Schnittstellen ProductRepository / ProductInfoSource / PriceSource – Speicher und
 * Anbieter lassen sich austauschen, ohne diese Klasse oder die App anzufassen.
 */
final class ProductService
{
    public const SCHEMA_VERSION = 1;

    /**
     * @param list<PriceSource> $priceSources
     * @param array{product:int, prices:int, not_found:int} $ttl
     * @param array{country_code:string, currency:string, max_age_days:int, keep_entries:int} $priceOptions
     */
    public function __construct(
        private readonly ProductRepository $repo,
        private readonly ProductInfoSource $infoSource,
        private readonly array $priceSources,
        private readonly array $ttl,
        private readonly array $priceOptions,
        private readonly Clock $clock = new Clock(),
    ) {
    }

    /**
     * @return array{record: array<string,mixed>, cache: array<string,mixed>, warnings: list<string>}
     * @throws \Saisonovo\Support\Exception\InvalidEanException
     * @throws ProductNotFoundException
     * @throws SourceException  nur wenn nichts im Cache liegt und die Stammdatenquelle ausfällt
     */
    public function lookup(string $rawEan, bool $forceRefresh = false): array
    {
        $ean = Ean::normalize($rawEan);
        $now = $this->clock->now();
        $warnings = [];
        $cached = $this->repo->find($ean);

        // Bekannt "nicht gefunden"? Dann OFF nicht bei jedem Scan erneut fragen.
        if ($cached && !empty($cached['not_found']) && !$forceRefresh
            && $now - (Clock::parse($cached['checked_at'] ?? null) ?? 0) < $this->ttl['not_found']) {
            throw new ProductNotFoundException('Dieses Produkt ist bei Open Food Facts noch nicht erfasst.');
        }
        if ($cached && !empty($cached['not_found'])) {
            $cached = null;
        }

        $record = $cached ?? ['schema_version' => self::SCHEMA_VERSION, 'code' => $ean, 'product' => [], '_meta' => []];
        $meta = $record['_meta'] ?? [];
        $productAge = $now - (Clock::parse($meta['product_fetched_at'] ?? null) ?? 0);
        $pricesAge = $now - (Clock::parse($meta['prices_fetched_at'] ?? null) ?? 0);
        $productStale = !$cached || $forceRefresh || $productAge > $this->ttl['product'];
        $pricesStale = !$cached || $forceRefresh || $pricesAge > $this->ttl['prices'];
        $updated = false;
        $stale = false;

        // ── 1. Stammdaten ───────────────────────────────────────────────
        if ($productStale) {
            try {
                $info = $this->infoSource->fetchProduct($ean);
                if ($info === null) {
                    if (!$cached) {
                        $this->repo->save($ean, ['schema_version' => self::SCHEMA_VERSION, 'code' => $ean, 'not_found' => true, 'checked_at' => $this->clock->iso($now)]);
                        throw new ProductNotFoundException('Dieses Produkt ist bei Open Food Facts noch nicht erfasst.');
                    }
                    $warnings[] = 'Open Food Facts kennt das Produkt nicht mehr – zeige gespeicherte Daten.';
                } else {
                    // Zusammenführen: neue Werte überschreiben, eigene/ältere Zusatzfelder bleiben erhalten
                    $record['product'] = array_replace($record['product'] ?? [], $info);
                    $meta['product_fetched_at'] = $this->clock->iso($now);
                    $meta['sources']['product'] = $this->infoSource->name();
                    $productAge = 0;
                    $updated = true;
                }
            } catch (SourceException $e) {
                if (!$cached) {
                    throw $e;
                }
                $stale = true;
                $warnings[] = $e->getMessage() . ' Produktdaten aus dem Cache.';
            }
        }

        // ── 2. Preise ───────────────────────────────────────────────────
        if ($pricesStale) {
            $context = [
                'product_name' => $record['product']['product_name_de'] ?? $record['product']['product_name'] ?? null,
                'brands'       => $record['product']['brands'] ?? null,
            ];
            $oldPrices = $record['product']['prices'] ?? [];
            $newPrices = [];
            $okSources = [];
            $failed = false;
            foreach ($this->priceSources as $src) {
                if (!$src->isEnabled()) {
                    continue;
                }
                try {
                    $newPrices = array_merge($newPrices, $src->fetchPrices($ean, $context));
                    $okSources[] = $src->name();
                } catch (SourceException $e) {
                    $failed = true;
                    $warnings[] = $e->getMessage() . ' Preise dieser Quelle aus dem Cache.';
                }
            }
            // Preise ausgefallener Quellen aus dem Cache behalten
            foreach ($oldPrices as $p) {
                if (!in_array($p['source'] ?? '', $okSources, true)) {
                    $newPrices[] = $p;
                }
            }
            $record['product']['prices'] = $this->dedupeAndTrim($newPrices);
            if ($okSources) {
                $meta['prices_fetched_at'] = $this->clock->iso($now);
                $meta['sources']['prices'] = $okSources;
                $pricesAge = 0;
            }
            if ($failed) {
                $stale = true;
                $meta['price_errors'] = array_values(array_filter($warnings, static fn ($w) => str_contains($w, 'Preise')));
            } else {
                unset($meta['price_errors']);
            }
            $updated = true;
        }

        // ── 3. Abgeleitete Felder (abwärtskompatibel ergänzt) ─────────
        $record['product']['price_summary'] = PriceSummary::build(
            $record['product']['prices'] ?? [],
            $this->priceOptions['country_code'],
            $this->priceOptions['currency'],
            $this->priceOptions['max_age_days'],
            $now,
        );
        $record['product']['sustainability'] = self::sustainability($record['product']);
        $record['schema_version'] = self::SCHEMA_VERSION;
        $record['code'] = $ean;
        $meta['updated_at'] = $updated ? $this->clock->iso($now) : ($meta['updated_at'] ?? $this->clock->iso($now));
        $record['_meta'] = $meta;

        if ($updated) {
            $this->repo->save($ean, $record);
        }

        return [
            'record'   => $record,
            'cache'    => [
                'hit'                => (bool) $cached && !$updated,
                'stale'              => $stale,
                'product_age_s'      => $productAge,
                'prices_age_s'       => $pricesAge,
                'product_fetched_at' => $meta['product_fetched_at'] ?? null,
                'prices_fetched_at'  => $meta['prices_fetched_at'] ?? null,
            ],
            'warnings' => $warnings,
        ];
    }

    /**
     * @param list<array<string,mixed>> $prices
     * @return list<array<string,mixed>>
     */
    private function dedupeAndTrim(array $prices): array
    {
        $seen = [];
        $out = [];
        foreach ($prices as $p) {
            $key = ($p['source'] ?? '') . '#' . ($p['source_id'] ?? md5(json_encode($p)));
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $p;
        }
        usort($out, static fn ($a, $b) => strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? '')));
        return array_slice($out, 0, $this->priceOptions['keep_entries']);
    }

    /**
     * Kompakte Nachhaltigkeits-Übersicht aus den OFF-Feldern (zusätzlich zu den Originalfeldern).
     * @param array<string,mixed> $p
     * @return array<string,mixed>
     */
    public static function sustainability(array $p): array
    {
        $grade = strtolower((string) ($p['ecoscore_grade'] ?? ''));
        $clean = static fn ($tags) => array_values(array_map(
            static fn ($t) => preg_replace('/^[a-z]{2}:/', '', (string) $t),
            is_array($tags) ? $tags : []
        ));
        $labels = $clean($p['labels_tags'] ?? []);
        return [
            'ecoscore_grade'   => in_array($grade, ['a-plus', 'a', 'b', 'c', 'd', 'e', 'f'], true) ? $grade : null,
            'ecoscore_score'   => isset($p['ecoscore_score']) && is_numeric($p['ecoscore_score']) ? (int) $p['ecoscore_score'] : null,
            'nutriscore_grade' => in_array(strtolower((string) ($p['nutriscore_grade'] ?? '')), ['a', 'b', 'c', 'd', 'e'], true) ? strtolower($p['nutriscore_grade']) : null,
            'nova_group'       => isset($p['nova_group']) && is_numeric($p['nova_group']) ? (int) $p['nova_group'] : null,
            'organic'          => (bool) array_intersect($labels, ['organic', 'eu-organic', 'de-bio-siegel', 'bio']),
            'labels'           => $labels,
            'packaging'        => $clean($p['packaging_materials_tags'] ?? []) ?: $clean($p['packaging_tags'] ?? []),
            'packaging_recycling' => $clean($p['packaging_recycling_tags'] ?? []),
        ];
    }
}

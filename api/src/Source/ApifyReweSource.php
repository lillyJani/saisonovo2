<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Http\HttpClient;
use Saisonovo\Repository\JsonFileStore;
use Saisonovo\Support\Exception\PricePendingException;
use Saisonovo\Support\Exception\SourceException;
use Saisonovo\Support\TextMatch;

/**
 * Apify "REWE Market Scraper" (scraping_empire/rewe-market) – REWE-Suche mit Postleitzahl für
 * lokale Marktpreise. Kommerziell (Apify-Token nötig). https://apify.com/scraping_empire/rewe-market
 *
 * Eingabe laut Actor: search_keywords (Liste), zip_code (Zahl), max_pages, startUrls, scrape_recommended
 * Ausgabe je Artikel: name, price, currency, grammage (inkl. Grundpreis), is_promo, detail_link, image, category, keyword
 * Ebenfalls KEINE EAN → Zuordnung über TextMatch.
 *
 * Ein Scraper-Lauf dauert meist länger als ein Scan. Deshalb asynchron:
 *   1. Scan: Lauf starten (POST /v2/acts/{actor}/runs), Lauf-ID merken → PricePendingException
 *   2. Nächste Abfrage: Status prüfen (GET /v2/actor-runs/{id}); fertig → Datensatz holen
 *      (GET /v2/datasets/{id}/items), Ergebnis 24 h je Suchbegriff+PLZ speichern.
 * Die App fragt automatisch nach, solange ein Lauf aussteht.
 */
final class ApifyReweSource implements PriceSource
{

    /** @param array<string,mixed> $config */
    public function __construct(
        private readonly HttpClient $http,
        private readonly array $config,
        private readonly JsonFileStore $store,
    ) {
    }

    public function name(): string
    {
        return 'apify_rewe';
    }

    public function isEnabled(): bool
    {
        return ($this->config['enabled'] ?? true) && !empty($this->config['token']);
    }

    private function api(): string
    {
        return rtrim((string) ($this->config['base_url'] ?? 'https://api.apify.com/v2'), '/');
    }

    private function actor(): string
    {
        return str_replace('/', '~', (string) ($this->config['actor_id'] ?? 'scraping_empire~rewe-market'));
    }

    private function auth(): array
    {
        return ['Authorization' => 'Bearer ' . $this->config['token']];
    }

    public function fetchPrices(string $ean, array $context = []): array
    {
        if (!$this->isEnabled() || empty($context['product_name'])) {
            return [];
        }
        $brand = trim(explode(',', (string) ($context['brands'] ?? ''))[0]);
        $query = trim($brand . ' ' . $context['product_name']);
        $plz = preg_match('/^\d{5}$/', (string) ($context['postcode'] ?? '')) ? (string) $context['postcode'] : (string) ($this->config['zip_code'] ?? '51063');
        $key = 'apify-' . md5(mb_strtolower($query) . '|' . $plz);
        $state = $this->store->get($key);
        $ttl = (int) ($this->config['result_ttl'] ?? 86400);

        // Fertiges Ergebnis aus den letzten 24 h
        if ($state && ($state['status'] ?? '') === 'done' && time() - (int) $state['finished_at'] < $ttl) {
            return $this->match($state['items'] ?? [], $context, $plz, (int) $state['finished_at']);
        }

        // Laufender Lauf → Status prüfen
        if ($state && ($state['status'] ?? '') === 'running' && time() - (int) $state['started_at'] < 1800) {
            try {
                $run = $this->http->getJson($this->api() . '/actor-runs/' . rawurlencode((string) $state['run_id']), $this->auth());
            } catch (SourceException $e) {
                throw $e->withSource($this->name());
            }
            $status = (string) ($run->data['data']['status'] ?? '');
            if (in_array($status, ['READY', 'RUNNING'], true)) {
                throw new PricePendingException('Lokale REWE-Preise werden noch abgefragt.', $this->name());
            }
            if ($status !== 'SUCCEEDED') {
                $this->store->delete($key);
                throw new SourceException("Apify-Lauf beendet mit Status {$status}.", $this->name());
            }
            $datasetId = (string) ($run->data['data']['defaultDatasetId'] ?? '');
            try {
                $items = $this->http->getJson($this->api() . '/datasets/' . rawurlencode($datasetId) . '/items?clean=true&limit=200', $this->auth());
            } catch (SourceException $e) {
                throw $e->withSource($this->name());
            }
            $list = array_values(array_filter($items->data, 'is_array'));
            $this->store->put($key, ['status' => 'done', 'query' => $query, 'plz' => $plz, 'finished_at' => time(), 'items' => $list]);
            return $this->match($list, $context, $plz, time());
        }

        // Neuen Lauf starten
        $input = [
            'search_keywords'    => [$query],
            'zip_code'           => (int) $plz,
            'max_pages'          => (int) ($this->config['max_pages'] ?? 1),
            'startUrls'          => [],
            'scrape_recommended' => 'no',
        ];
        try {
            $run = $this->http->postJson($this->api() . '/acts/' . rawurlencode($this->actor()) . '/runs', $input, $this->auth(), [200, 201]);
        } catch (SourceException $e) {
            throw $e->withSource($this->name());
        }
        $runId = (string) ($run->data['data']['id'] ?? '');
        if ($runId === '') {
            throw new SourceException('Apify hat keinen Lauf gestartet.', $this->name());
        }
        $this->store->put($key, ['status' => 'running', 'run_id' => $runId, 'query' => $query, 'plz' => $plz, 'started_at' => time()]);
        throw new PricePendingException('Lokale REWE-Preise werden abgefragt.', $this->name());
    }

    /**
     * @param list<array<string,mixed>> $items
     * @return list<array<string,mixed>>
     */
    private function match(array $items, array $context, string $plz, int $ts): array
    {
        $wanted = ['name' => (string) $context['product_name'], 'brand' => $context['brands'] ?? null, 'quantity' => $context['quantity'] ?? null];
        $best = null;
        $bestScore = 0.0;
        foreach ($items as $it) {
            $price = self::parsePrice($it['price'] ?? null);
            if ($price === null || empty($it['name'])) {
                continue;
            }
            $s = TextMatch::score($wanted, (string) $it['name'], isset($it['grammage']) ? (string) $it['grammage'] : null);
            if ($s > $bestScore) {
                $bestScore = $s;
                $best = [$it, $price];
            }
        }
        if (!$best || $bestScore < (float) ($this->config['min_match'] ?? 0.7)) {
            return [];
        }
        [$it, $price] = $best;
        $unit = null;
        if (isset($it['grammage']) && preg_match('/\(([^)]*)\)/', (string) $it['grammage'], $m)) {
            $unit = trim($m[1]);
        }
        return [[
            'source'        => $this->name(),
            'source_id'     => (string) ($it['id'] ?? $it['detail_link'] ?? md5((string) $it['name'])),
            'price'         => $price,
            'currency'      => (string) ($it['currency'] ?? 'EUR') ?: 'EUR',
            'date'          => gmdate('Y-m-d', $ts),
            'is_discounted' => filter_var($it['is_promo'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'price_without_discount' => null,
            'price_per'     => null,
            'unit_price'    => $unit,
            'store'         => 'REWE',
            'city'          => null,
            'postcode'      => $plz,
            'country_code'  => 'DE',
            'kind'          => 'online',
            'matched_name'  => (string) $it['name'],
            'match_score'   => $bestScore,
            'url'           => isset($it['detail_link']) && str_starts_with((string) $it['detail_link'], 'http') ? (string) $it['detail_link'] : null,
        ]];
    }

    /** "1,99 €", "1.99", 1.99, 199 (Cent?) → 1.99 */
    public static function parsePrice(mixed $v): ?float
    {
        if (is_int($v) || is_float($v)) {
            return round((float) $v, 2);
        }
        if (!is_string($v) || !preg_match('/(\d+)(?:[.,](\d{1,2}))?/', $v, $m)) {
            return null;
        }
        return round((float) ($m[1] . '.' . ($m[2] ?? '0')), 2);
    }
}

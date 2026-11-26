<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Http\HttpClient;
use Saisonovo\Repository\JsonFileStore;
use Saisonovo\Support\Exception\SourceException;
use Saisonovo\Support\TextMatch;

/**
 * Pepesto – tagesaktuelle REWE-Katalogpreise (shop.rewe.de), kommerziell, API-Schlüssel nötig.
 * Doku: https://github.com/pepesto-solutions/openapi-spec (openapi.yaml) · https://www.pepesto.com/supermarkets/rewe/
 *
 * POST https://s.pepesto.com/api/catalog  {"supermarket_domain":"shop.rewe.de"}
 * Header: Authorization: Bearer pep_sk_…
 * Antwort: {"parsed_products": {"<Produkt-URL>": {"names":{"de":…,"en":…}, "price": 199 (Cent),
 *           "currency":"EUR", "promo":true, "quantity_str":"500g", "price_per_meausure_unit":"…", "tags":[…]}}}
 *
 * Pepesto liefert KEINE EAN. Der Katalog (ca. 1.000–2.000 gängige Lebensmittel) wird deshalb
 * höchstens einmal pro Tag geladen, lokal gespeichert und das gescannte Produkt über Marke,
 * Name und Packungsgröße zugeordnet (TextMatch). Nur sichere Treffer werden übernommen.
 * Tipp: Katalog per Cronjob vorladen (php api/cron.php), dann wartet kein Scan darauf.
 */
final class PepestoReweSource implements PriceSource
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
        return 'pepesto_rewe';
    }

    public function isEnabled(): bool
    {
        return ($this->config['enabled'] ?? true) && !empty($this->config['api_key']);
    }

    private function domain(): string
    {
        return (string) ($this->config['supermarket_domain'] ?? 'shop.rewe.de');
    }

    /**
     * Katalog aus dem Speicher; nach Ablauf (Standard 24 h) neu laden. Fällt Pepesto aus,
     * wird der ältere Katalog weiter genutzt.
     * @return array{fetched_at:int, products:array<string,array<string,mixed>>}
     */
    public function catalog(bool $force = false): array
    {
        $key = 'pepesto-' . $this->domain();
        $cached = $this->store->get($key);
        $ttl = (int) ($this->config['catalog_ttl'] ?? 86400);
        if (!$force && $cached && time() - (int) ($cached['fetched_at'] ?? 0) < $ttl) {
            return $cached;
        }
        try {
            $res = $this->http->postJson(
                rtrim((string) ($this->config['base_url'] ?? 'https://s.pepesto.com/api'), '/') . '/catalog',
                ['supermarket_domain' => $this->domain()],
                ['Authorization' => 'Bearer ' . $this->config['api_key']],
                [200],
                (int) ($this->config['timeout'] ?? 30),
            );
        } catch (SourceException $e) {
            if ($cached) {
                return $cached;   // alter Katalog ist besser als keiner
            }
            throw $e->withSource($this->name());
        }
        $products = $res->data['parsed_products'] ?? null;
        if (!is_array($products)) {
            if ($cached) {
                return $cached;
            }
            throw new SourceException('Pepesto lieferte keinen Katalog.', $this->name());
        }
        $catalog = ['fetched_at' => time(), 'domain' => $this->domain(), 'products' => $products];
        $this->store->put($key, $catalog);
        return $catalog;
    }

    public function fetchPrices(string $ean, array $context = []): array
    {
        if (!$this->isEnabled() || empty($context['product_name'])) {
            return [];
        }
        $catalog = $this->catalog();
        $wanted = ['name' => (string) $context['product_name'], 'brand' => $context['brands'] ?? null, 'quantity' => $context['quantity'] ?? null];
        $best = null;
        $bestScore = 0.0;
        foreach ($catalog['products'] as $url => $p) {
            if (!is_array($p) || !isset($p['price'])) {
                continue;
            }
            $name = (string) ($p['names']['de'] ?? $p['names']['en'] ?? reset($p['names']) ?: '');
            $s = TextMatch::score($wanted, $name, $p['quantity_str'] ?? null);
            if ($s > $bestScore) {
                $bestScore = $s;
                $best = [$url, $p, $name];
            }
        }
        if (!$best || $bestScore < (float) ($this->config['min_match'] ?? 0.7)) {
            return [];
        }
        [$url, $p, $name] = $best;
        return [[
            'source'        => $this->name(),
            'source_id'     => (string) $url,
            'price'         => round(((int) $p['price']) / 100, 2),
            'currency'      => (string) ($p['currency'] ?? 'EUR'),
            'date'          => gmdate('Y-m-d', (int) $catalog['fetched_at']),
            'is_discounted' => !empty($p['promo']),
            'price_without_discount' => null,
            'price_per'     => null,
            'unit_price'    => $p['price_per_meausure_unit'] ?? null,   // Schreibweise laut Pepesto-API
            'store'         => 'REWE',
            'city'          => null,
            'postcode'      => null,
            'country_code'  => 'DE',
            'kind'          => 'online',
            'matched_name'  => $name,
            'match_score'   => $bestScore,
            'url'           => is_string($url) && str_starts_with($url, 'http') ? $url : null,
        ]];
    }
}

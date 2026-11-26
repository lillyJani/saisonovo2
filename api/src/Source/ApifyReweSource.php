<?php
declare(strict_types=1);

namespace Saisonovo\Source;

/**
 * Apify REWE Market Scraper – Suche/Kategorien mit PLZ-Filter für lokale REWE-Preise (kommerziell).
 * https://apify.com
 *
 * Nutzt die Apify-Schnittstelle "run-sync-get-dataset-items": Der Actor wird gestartet und die
 * gefundenen Produkte kommen direkt zurück. Da REWE nach Text sucht, wird der Produktname aus
 * Open Food Facts verwendet und das Ergebnis über die EAN gefiltert (falls der Actor sie liefert).
 *
 * Einrichten: 'apify_rewe' => ['enabled' => true, 'token' => …, 'actor_id' => 'benutzer~actor', 'postcode' => '10115'].
 * TODO: Eingabefelder (search/postalCode) und mapItems() an den gewählten Actor anpassen.
 * Hinweis: Ein Actor-Lauf dauert oft mehrere Sekunden – für Live-Scans ggf. per Cronjob vorab befüllen.
 */
final class ApifyReweSource extends AbstractCommercialPriceSource
{
    public function name(): string
    {
        return 'apify_rewe';
    }

    protected function isConfigured(): bool
    {
        return !empty($this->config['token']) && !empty($this->config['actor_id']);
    }

    protected function buildRequest(string $ean, array $context): array
    {
        $query = trim(($context['brands'] ?? '') . ' ' . ($context['product_name'] ?? '')) ?: $ean;
        return [
            'method'  => 'POST',
            'url'     => 'https://api.apify.com/v2/acts/' . rawurlencode((string) $this->config['actor_id'])
                . '/run-sync-get-dataset-items?token=' . rawurlencode((string) $this->config['token']),
            'headers' => [],
            'body'    => [
                'search'     => $query,
                'postalCode' => (string) ($context['postcode'] ?? $this->config['postcode'] ?? ''),
                'maxItems'   => 10,
            ],
        ];
    }

    protected function mapItems(array $data, string $ean): array
    {
        $out = [];
        foreach ($data as $p) {
            if (!is_array($p)) {
                continue;
            }
            $gtin = (string) ($p['gtin'] ?? $p['ean'] ?? '');
            if ($gtin !== '' && ltrim($gtin, '0') !== ltrim($ean, '0')) {
                continue;
            }
            $price = $p['price'] ?? $p['currentPrice'] ?? null;
            if (!is_numeric($price)) {
                continue;
            }
            $out[] = $this->entry((float) $price, gmdate('Y-m-d'), 'REWE', [
                'source_id' => isset($p['id']) ? (string) $p['id'] : null,
                'postcode'  => $this->config['postcode'] ?? null,
                'kind'      => 'online',
            ]);
        }
        return $out;
    }
}

<?php
declare(strict_types=1);

namespace Saisonovo\Source;

/**
 * Preiszeiger B2B-Feeds – Preise von Discountern wie ALDI und LIDL (kommerziell).
 * https://preiszeiger.eu
 *
 * Einrichten: 'preiszeiger' => ['enabled' => true, 'api_key' => …, 'endpoint' => 'https://…?gtin={ean}'].
 * TODO nach Vertragsabschluss: Feed-Format prüfen. Bei reinen Datei-Feeds (CSV/JSON) besser per
 *      Cronjob importieren und hier nur aus der lokalen Tabelle lesen.
 */
final class PreiszeigerSource extends AbstractCommercialPriceSource
{
    public function name(): string
    {
        return 'preiszeiger';
    }

    protected function isConfigured(): bool
    {
        return !empty($this->config['api_key']) && !empty($this->config['endpoint']);
    }

    protected function buildRequest(string $ean, array $context): array
    {
        return [
            'method'  => 'GET',
            'url'     => str_replace('{ean}', rawurlencode($ean), (string) $this->config['endpoint']),
            'headers' => ['X-API-Key' => (string) $this->config['api_key']],
        ];
    }

    protected function mapItems(array $data, string $ean): array
    {
        // Erwartete Struktur (anzupassen): {"offers":[{"retailer":"ALDI SÜD","price":0.99,"valid_from":"2026-11-19"}]}
        $out = [];
        foreach ($data['offers'] ?? $data['items'] ?? [] as $o) {
            if (!is_array($o) || !is_numeric($o['price'] ?? null)) {
                continue;
            }
            $out[] = $this->entry((float) $o['price'], (string) ($o['valid_from'] ?? $o['date'] ?? gmdate('Y-m-d')),
                $o['retailer'] ?? $o['store'] ?? null, ['kind' => 'catalog']);
        }
        return $out;
    }
}

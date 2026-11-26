<?php
declare(strict_types=1);

namespace Saisonovo\Source;

/**
 * Pepesto REWE API – tagesaktuelle Katalog- und Preisdaten (kommerziell, API-Schlüssel nötig).
 * https://pepesto.com
 *
 * Einrichten: in config.local.php 'pepesto_rewe' => ['enabled' => true, 'api_key' => …, 'endpoint' => 'https://…{ean}…'].
 * TODO nach Vertragsabschluss: Endpunkt/Auth-Header laut Pepesto-Doku prüfen und mapItems()
 *      an eine echte Beispielantwort anpassen.
 */
final class PepestoReweSource extends AbstractCommercialPriceSource
{
    public function name(): string
    {
        return 'pepesto_rewe';
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
            'headers' => ['Authorization' => 'Bearer ' . $this->config['api_key']],
        ];
    }

    protected function mapItems(array $data, string $ean): array
    {
        // Erwartete Struktur (anzupassen): {"products":[{"gtin":"…","price":1.99,"currency":"EUR","date":"…"}]}
        $out = [];
        foreach ($data['products'] ?? $data['items'] ?? [] as $p) {
            if (!is_array($p) || !isset($p['price']) || !is_numeric($p['price'])) {
                continue;
            }
            if (isset($p['gtin']) && ltrim((string) $p['gtin'], '0') !== ltrim($ean, '0')) {
                continue;
            }
            $out[] = $this->entry((float) $p['price'], (string) ($p['date'] ?? gmdate('Y-m-d')), 'REWE', [
                'source_id' => isset($p['id']) ? (string) $p['id'] : null,
                'kind' => 'online',
            ]);
        }
        return $out;
    }
}

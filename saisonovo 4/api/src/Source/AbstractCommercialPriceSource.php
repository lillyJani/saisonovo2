<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Http\HttpClient;
use Saisonovo\Support\Exception\SourceException;

/**
 * Basis für kommerzielle Preis-APIs. Ohne Schlüssel/Endpunkt ist die Quelle automatisch inaktiv,
 * es werden also keine Anfragen gestellt. Konkrete Adapter überschreiben nur
 * buildRequest() und mapItems() – sobald ein Vertrag und eine Beispielantwort vorliegen.
 */
abstract class AbstractCommercialPriceSource implements PriceSource
{
    /** @param array<string,mixed> $config */
    public function __construct(
        protected readonly HttpClient $http,
        protected readonly array $config,
    ) {
    }

    public function isEnabled(): bool
    {
        return !empty($this->config['enabled']) && $this->isConfigured();
    }

    abstract protected function isConfigured(): bool;

    /**
     * @param array<string,mixed> $context
     * @return array{method: string, url: string, headers: array<string,string>, body?: array<string,mixed>}
     */
    abstract protected function buildRequest(string $ean, array $context): array;

    /**
     * Antwort des Anbieters ins gemeinsame Preisformat (siehe PriceSource) übersetzen.
     * @param array<mixed> $data
     * @return list<array<string,mixed>>
     */
    abstract protected function mapItems(array $data, string $ean): array;

    public function fetchPrices(string $ean, array $context = []): array
    {
        if (!$this->isEnabled()) {
            return [];
        }
        $req = $this->buildRequest($ean, $context);
        try {
            $res = $req['method'] === 'POST'
                ? $this->http->postJson($req['url'], $req['body'] ?? [], $req['headers'])
                : $this->http->getJson($req['url'], $req['headers']);
        } catch (SourceException $e) {
            throw $e->withSource($this->name());
        }
        return $this->mapItems($res->data, $ean);
    }

    /** Hilfsfunktion für Adapter: einheitlichen Preis-Eintrag bauen. */
    protected function entry(float $price, string $date, ?string $store, array $extra = []): array
    {
        return array_merge([
            'source' => $this->name(), 'source_id' => null, 'price' => $price, 'currency' => 'EUR',
            'date' => $date, 'is_discounted' => false, 'price_without_discount' => null, 'price_per' => null,
            'store' => $store, 'city' => null, 'postcode' => null, 'country_code' => 'DE', 'kind' => 'catalog',
        ], $extra);
    }
}

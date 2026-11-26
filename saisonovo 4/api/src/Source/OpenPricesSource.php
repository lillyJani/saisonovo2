<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Http\HttpClient;
use Saisonovo\Support\Exception\SourceException;

/**
 * Open Prices (Open Food Facts) – Community-Preise aus Kassenbons und Preisschildern.
 * Abfrage: GET /api/v1/prices?product_code={EAN}&order_by=-date
 * Doku/Datenmodell: https://prices.openfoodfacts.org/api/docs · https://wiki.openfoodfacts.org/Open_Prices
 */
final class OpenPricesSource implements PriceSource
{
    public function __construct(
        private readonly HttpClient $http,
        private readonly string $baseUrl = 'https://prices.openfoodfacts.org',
        private readonly int $pageSize = 50,
        private readonly bool $enabled = true,
        private readonly ?string $token = null,
        private readonly bool $uploadEnabled = false,
    ) {
    }

    public function name(): string
    {
        return 'open_prices';
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function fetchPrices(string $ean, array $context = []): array
    {
        $url = rtrim($this->baseUrl, '/') . '/api/v1/prices?' . http_build_query([
            'product_code' => $ean,
            'order_by'     => '-date',
            'size'         => $this->pageSize,
        ]);
        try {
            $res = $this->http->getJson($url);
        } catch (SourceException $e) {
            throw $e->withSource($this->name());
        }
        $out = [];
        foreach ($res->data['items'] ?? [] as $item) {
            if (!is_array($item) || !isset($item['price']) || !is_numeric($item['price'])) {
                continue;
            }
            $loc = is_array($item['location'] ?? null) ? $item['location'] : [];
            $proofType = is_array($item['proof'] ?? null) ? ($item['proof']['type'] ?? null) : null;
            $out[] = [
                'source'        => $this->name(),
                'source_id'     => (string) ($item['id'] ?? ''),
                'price'         => (float) $item['price'],
                'currency'      => (string) ($item['currency'] ?? ''),
                'date'          => (string) ($item['date'] ?? ''),
                'is_discounted' => (bool) ($item['price_is_discounted'] ?? false),
                'price_without_discount' => isset($item['price_without_discount']) ? (float) $item['price_without_discount'] : null,
                'price_per'     => $item['price_per'] ?? null,
                'store'         => $loc['osm_brand'] ?? $loc['osm_name'] ?? null,
                'city'          => $loc['osm_address_city'] ?? null,
                'postcode'      => $loc['osm_address_postcode'] ?? null,
                'country_code'  => $loc['osm_address_country_code'] ?? null,
                'kind'          => match ($proofType) {
                    'RECEIPT'   => 'receipt',
                    'PRICE_TAG' => 'price_tag',
                    'SHOP_IMPORT' => 'catalog',
                    default     => 'community',
                },
            ];
        }
        return $out;
    }

    public function canUpload(): bool
    {
        return $this->uploadEnabled && $this->token !== null && $this->token !== '';
    }

    /**
     * Vorbereitung: eigenen Preis aus der App an Open Prices melden.
     * Erfordert ein Open-Prices-Konto (Token über POST /api/v1/auth) und in der Regel einen
     * Beleg (proof_id: vorher Foto von Kassenbon/Preisschild über POST /api/v1/proofs/upload hochladen)
     * sowie den Markt als OpenStreetMap-Objekt (location_osm_id/location_osm_type).
     *
     * @param array{price: float, currency: string, date: string, location_osm_id: int, location_osm_type: string, proof_id?: int, price_is_discounted?: bool} $price
     * @return array<string,mixed>  angelegter Preis laut API
     */
    public function uploadPrice(string $ean, array $price): array
    {
        if (!$this->canUpload()) {
            throw new SourceException('Preis-Upload ist nicht eingerichtet (Token in config.local.php fehlt).', $this->name());
        }
        $body = ['type' => 'PRODUCT', 'product_code' => $ean] + $price;
        try {
            $res = $this->http->postJson(
                rtrim($this->baseUrl, '/') . '/api/v1/prices',
                $body,
                ['Authorization' => 'Bearer ' . $this->token],
            );
        } catch (SourceException $e) {
            throw $e->withSource($this->name());
        }
        return $res->data;
    }
}

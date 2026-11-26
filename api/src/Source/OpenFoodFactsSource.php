<?php
declare(strict_types=1);

namespace Saisonovo\Source;

use Saisonovo\Http\HttpClient;
use Saisonovo\Support\Exception\SourceException;

/**
 * Open Food Facts – Produktdaten per EAN (API v2).
 * Liefert die Felder im Original-OFF-Format, damit das bestehende Frontend (renderScanResult)
 * sie unverändert anzeigen kann. Der Pflicht-User-Agent kommt aus dem HttpClient.
 * Doku: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
final class OpenFoodFactsSource implements ProductInfoSource
{
    /** Felder, die die App heute nutzt, plus Nachhaltigkeit, Siegel, Verpackung, Zutaten, Nährwerte. */
    public const FIELDS = [
        // bisher von der App genutzt
        'product_name', 'product_name_de', 'brands', 'quantity', 'ecoscore_grade', 'nutriscore_grade',
        'origins', 'origins_tags', 'manufacturing_places', 'categories_tags',
        // neu: Nachhaltigkeit & Siegel
        'ecoscore_score', 'ecoscore_data', 'labels_tags', 'packaging_materials_tags', 'packaging_tags',
        'packaging_recycling_tags', 'nova_group', 'nutriscore_score',
        // neu: Zutaten & Nährwerte
        'ingredients_text_de', 'ingredients_text', 'allergens_tags', 'nutriments',
        // Anzeige
        'image_front_small_url', 'image_url', 'product_quantity', 'product_quantity_unit',
    ];

    public function __construct(
        private readonly HttpClient $http,
        private readonly string $baseUrl = 'https://world.openfoodfacts.org',
    ) {
    }

    public function name(): string
    {
        return 'openfoodfacts';
    }

    public function fetchProduct(string $ean): ?array
    {
        $url = rtrim($this->baseUrl, '/') . '/api/v2/product/' . rawurlencode($ean)
            . '?fields=' . implode(',', self::FIELDS);
        try {
            // OFF antwortet bei unbekannten Produkten mit HTTP 404 und {"status":0}
            $res = $this->http->getJson($url, [], [200, 404]);
        } catch (SourceException $e) {
            throw $e->withSource($this->name());
        }
        if (($res->data['status'] ?? 0) !== 1 || empty($res->data['product'])) {
            return null;
        }
        $p = $res->data['product'];
        // Nur die Nährwerte pro 100 g behalten – der Rest bläht den Cache auf
        if (isset($p['nutriments']) && is_array($p['nutriments'])) {
            $p['nutriments'] = array_filter(
                $p['nutriments'],
                static fn ($k) => str_ends_with((string) $k, '_100g') || str_ends_with((string) $k, '_unit'),
                ARRAY_FILTER_USE_KEY
            );
        }
        // ecoscore_data ist sehr groß – nur die für die App relevanten Teile übernehmen
        if (isset($p['ecoscore_data']) && is_array($p['ecoscore_data'])) {
            $d = $p['ecoscore_data'];
            $p['ecoscore_data'] = array_filter([
                'score'      => $d['score'] ?? null,
                'grade'      => $d['grade'] ?? null,
                'adjustments' => isset($d['adjustments']) ? array_map(
                    static fn ($a) => is_array($a) ? array_intersect_key($a, array_flip(['value', 'warning', 'transportation_value', 'epi_value'])) : $a,
                    array_intersect_key($d['adjustments'], array_flip(['origins_of_ingredients', 'packaging', 'production_system', 'threatened_species']))
                ) : null,
            ], static fn ($v) => $v !== null);
        }
        return $p;
    }
}

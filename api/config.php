<?php
/**
 * Saisonovo API – Konfiguration.
 *
 * Werte werden aus Umgebungsvariablen gelesen. Für lokale Einstellungen und API-Schlüssel
 * eine Datei config.local.php anlegen (Vorlage: config.local.example.php). Sie wird hier
 * zusammengeführt und ist per .gitignore vom Repository ausgenommen.
 */

$env = static function (string $key, $default = null) {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
};

$config = [
    // Kontakt im User-Agent ist bei Open Food Facts Pflicht (App-Name/Version + Kontakt).
    'user_agent'      => $env('SAISONOVO_USER_AGENT', 'Saisonovo/1.0 (lillyjani28@gmail.com)'),

    // Cache
    'data_dir'        => $env('SAISONOVO_DATA_DIR', __DIR__ . '/data/products'),
    'ttl' => [
        'product'   => (int) $env('SAISONOVO_TTL_PRODUCT', 30 * 24 * 3600), // Stammdaten (OFF): 30 Tage
        'prices'    => (int) $env('SAISONOVO_TTL_PRICES', 24 * 3600),       // Preise: 24 Stunden
        'not_found' => (int) $env('SAISONOVO_TTL_NOT_FOUND', 24 * 3600),    // "nicht gefunden" merken: 24 Stunden
    ],

    // Preise: bevorzugtes Land/Währung für die Zusammenfassung, maximales Alter einzelner Preise
    'prices' => [
        'country_code' => $env('SAISONOVO_PRICE_COUNTRY', 'DE'),
        'currency'     => $env('SAISONOVO_PRICE_CURRENCY', 'EUR'),
        'max_age_days' => (int) $env('SAISONOVO_PRICE_MAX_AGE_DAYS', 365),
        'keep_entries' => 20,   // so viele Einzelpreise je Produkt im Cache behalten
    ],

    // HTTP
    'http' => [
        'connect_timeout' => 4,
        'timeout'         => 8,
    ],

    // CORS: erlaubte Herkunft der App (z. B. 'https://lillyjani.github.io'); '*' = alle
    'cors_origin' => $env('SAISONOVO_CORS_ORIGIN', '*'),

    'sources' => [
        'openfoodfacts' => [
            'enabled'  => true,
            'base_url' => $env('OFF_BASE_URL', 'https://world.openfoodfacts.org'),
        ],
        'open_prices' => [
            'enabled'  => true,
            'base_url' => $env('OPEN_PRICES_BASE_URL', 'https://prices.openfoodfacts.org'),
            'page_size' => 50,
            // Nur für den (optionalen) Preis-Upload aus der App nötig:
            'token'    => $env('OPEN_PRICES_TOKEN'),
            'upload_enabled' => (bool) $env('OPEN_PRICES_UPLOAD_ENABLED', false),
        ],

        // ── Kommerzielle Preis-APIs (vorbereitet, ohne Schlüssel automatisch inaktiv) ──
        'pepesto_rewe' => [
            'enabled'  => false,
            'api_key'  => $env('PEPESTO_API_KEY'),
            // Endpunkt laut Pepesto-Dokumentation eintragen; {ean} wird ersetzt.
            'endpoint' => $env('PEPESTO_ENDPOINT'),
        ],
        'apify_rewe' => [
            'enabled'  => false,
            'token'    => $env('APIFY_TOKEN'),
            // Actor-ID des REWE-Scrapers aus dem Apify Store, z. B. 'benutzer~rewe-scraper'
            'actor_id' => $env('APIFY_REWE_ACTOR'),
            'postcode' => $env('APIFY_REWE_POSTCODE', '10115'),
        ],
        'preiszeiger' => [
            'enabled'  => false,
            'api_key'  => $env('PREISZEIGER_API_KEY'),
            'endpoint' => $env('PREISZEIGER_ENDPOINT'),
        ],
    ],
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $override = require $local;
    if (is_array($override)) {
        $config = array_replace_recursive($config, $override);
    }
}

return $config;

<?php
/**
 * Vorlage für lokale Einstellungen. Kopieren nach config.local.php und anpassen.
 * config.local.php wird NICHT eingecheckt (siehe .gitignore) – API-Schlüssel gehören nur dorthin.
 */
return [
    // 'cors_origin' => 'https://lillyjani.github.io',
    // 'ttl' => ['prices' => 12 * 3600],

    'sources' => [
        // Eigenen Preis-Upload zu Open Prices erlauben (Token über POST /api/v1/auth erzeugen):
        // 'open_prices' => ['token' => '…', 'upload_enabled' => true],

        // 'pepesto_rewe' => ['enabled' => true, 'api_key' => '…', 'endpoint' => 'https://…/{ean}'],
        // 'apify_rewe'   => ['enabled' => true, 'token' => '…', 'actor_id' => 'benutzer~rewe-scraper', 'postcode' => '10115'],
        // 'preiszeiger'  => ['enabled' => true, 'api_key' => '…', 'endpoint' => 'https://…?gtin={ean}'],
    ],
];

<?php
/**
 * Vorlage für lokale Einstellungen. Kopieren nach config.local.php und anpassen.
 * config.local.php wird NICHT eingecheckt (siehe .gitignore) – API-Schlüssel gehören nur dorthin.
 */
return [
    // 'cors_origin' => 'https://lillyjani.github.io',
    // 'ttl' => ['prices' => 12 * 3600],

    'sources' => [

        // Pepesto (REWE-Katalog): Schlüssel nach dem Kauf über
        //   curl -X POST https://s.pepesto.com/api/link -H "Content-Type: application/json" -d '{"email":"…"}'
        // 'pepesto_rewe' => ['api_key' => 'pep_sk_…'],
        //
        // Apify REWE Market Scraper (lokale Preise): Token unter Apify Console → Settings → API & Integrations
        // 'apify_rewe' => ['token' => 'apify_api_…', 'zip_code' => '10115'],
        // 'preiszeiger'  => ['enabled' => true, 'api_key' => '…', 'endpoint' => 'https://…?gtin={ean}'],
    ],
];

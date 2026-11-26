<?php
/**
 * Tägliche Vorbereitung (nur Kommandozeile), z. B. per Cronjob um 5 Uhr:
 *   0 5 * * *  php /pfad/zu/saisonovo/api/cron.php
 *
 * Lädt den Pepesto-REWE-Katalog vor, damit kein Scan auf den Download warten muss.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';

$c = saisonovo_config();
$http = new \Saisonovo\Http\HttpClient($c['user_agent'], $c['http']['connect_timeout'], $c['http']['timeout']);
$store = new \Saisonovo\Repository\JsonFileStore($c['store_dir']);
$pepesto = new \Saisonovo\Source\PepestoReweSource($http, $c['sources']['pepesto_rewe'], $store);

if (!$pepesto->isEnabled()) {
    fwrite(STDOUT, "Pepesto ist nicht eingerichtet (kein API-Schlüssel) – nichts zu tun.\n");
    exit(0);
}
try {
    $cat = $pepesto->catalog(true);
    fwrite(STDOUT, sprintf("Pepesto-Katalog %s: %d Artikel geladen.\n", $cat['domain'] ?? '', count($cat['products'] ?? [])));
} catch (\Throwable $e) {
    fwrite(STDERR, 'Fehler: ' . $e->getMessage() . "\n");
    exit(1);
}

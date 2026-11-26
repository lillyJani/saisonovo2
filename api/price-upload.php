<?php
/**
 * POST api/price-upload.php  (vorbereitet, standardmäßig deaktiviert)
 * Body (JSON): {"ean":"…","price":1.99,"currency":"EUR","date":"2026-11-19",
 *               "location_osm_id":123,"location_osm_type":"NODE","proof_id":456}
 *
 * Meldet einen Preis an Open Prices. Aktivieren in config.local.php:
 *   'sources' => ['open_prices' => ['token' => '…', 'upload_enabled' => true]]
 * Vor dem Freischalten Missbrauchsschutz ergänzen (z. B. Anmeldung in der App, Rate-Limit).
 */
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use Saisonovo\Source\OpenPricesSource;
use Saisonovo\Support\Ean;
use Saisonovo\Support\Exception\InvalidEanException;
use Saisonovo\Support\Exception\SourceException;

$config = saisonovo_config();
saisonovo_send_cors($config);
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    saisonovo_error(405, 'method_not_allowed', 'Nur POST ist erlaubt.');
}

$op = $config['sources']['open_prices'];
$http = new \Saisonovo\Http\HttpClient($config['user_agent'], $config['http']['connect_timeout'], $config['http']['timeout']);
$source = new OpenPricesSource($http, $op['base_url'], (int) $op['page_size'], true, $op['token'] ?? null, (bool) ($op['upload_enabled'] ?? false));
if (!$source->canUpload()) {
    saisonovo_error(501, 'upload_disabled', 'Der Preis-Upload ist noch nicht eingerichtet.');
}

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    saisonovo_error(400, 'invalid_body', 'JSON-Body erwartet.');
}
try {
    $ean = Ean::normalize((string) ($in['ean'] ?? ''));
    if (!is_numeric($in['price'] ?? null) || (float) $in['price'] <= 0) {
        saisonovo_error(400, 'invalid_price', 'Bitte einen gültigen Preis angeben.');
    }
    if (empty($in['location_osm_id']) || empty($in['location_osm_type'])) {
        saisonovo_error(400, 'missing_location', 'Der Markt (OpenStreetMap-ID und -Typ) fehlt.');
    }
    $created = $source->uploadPrice($ean, array_filter([
        'price'             => (float) $in['price'],
        'currency'          => (string) ($in['currency'] ?? 'EUR'),
        'date'              => (string) ($in['date'] ?? gmdate('Y-m-d')),
        'location_osm_id'   => (int) $in['location_osm_id'],
        'location_osm_type' => strtoupper((string) $in['location_osm_type']),
        'proof_id'          => isset($in['proof_id']) ? (int) $in['proof_id'] : null,
        'price_is_discounted' => isset($in['price_is_discounted']) ? (bool) $in['price_is_discounted'] : null,
    ], static fn ($v) => $v !== null));
    saisonovo_json(201, ['status' => 1, 'price' => $created]);
} catch (InvalidEanException $e) {
    saisonovo_error(400, 'invalid_ean', $e->getMessage());
} catch (SourceException $e) {
    saisonovo_error($e->isTimeout() ? 504 : 502, 'upstream_error', $e->getMessage());
}

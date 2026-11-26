<?php
/**
 * GET api/scan.php?ean=4006381333931[&refresh=1][&plz=10115]
 *
 * Liefert ein Produkt im Open-Food-Facts-Format ({"status":1,"product":{…}}), angereichert um
 * prices, price_summary, sustainability und _meta. Antwortcodes:
 *   200 gefunden · 400 ungültige EAN · 404 nicht gefunden · 502 Quelle fehlerhaft · 504 Zeitüberschreitung
 */
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use Saisonovo\Support\Exception\InvalidEanException;
use Saisonovo\Support\Exception\ProductNotFoundException;
use Saisonovo\Support\Exception\SourceException;

$config = saisonovo_config();
saisonovo_send_cors($config);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    saisonovo_error(405, 'method_not_allowed', 'Nur GET ist erlaubt.');
}

$ean = (string) ($_GET['ean'] ?? $_GET['code'] ?? '');
$refresh = isset($_GET['refresh']) && $_GET['refresh'] !== '0';
$plz = preg_match('/^\d{5}$/', (string) ($_GET['plz'] ?? '')) ? (string) $_GET['plz'] : null;   // für lokale Marktpreise

try {
    $result = saisonovo_service()->lookup($ean, $refresh, array_filter(['postcode' => $plz]));
    $record = $result['record'];
    saisonovo_json(200, [
        'status'   => 1,
        'code'     => $record['code'],
        'product'  => $record['product'] + ['_meta' => $record['_meta']],
        'cache'    => $result['cache'],
        'warnings' => $result['warnings'],
    ]);
} catch (InvalidEanException $e) {
    saisonovo_error(400, 'invalid_ean', $e->getMessage());
} catch (ProductNotFoundException $e) {
    saisonovo_error(404, 'not_found', $e->getMessage(), ['code' => preg_replace('/\D/', '', $ean)]);
} catch (SourceException $e) {
    $timeout = $e->isTimeout();
    saisonovo_error(
        $timeout ? 504 : 502,
        $timeout ? 'upstream_timeout' : 'upstream_error',
        $timeout ? 'Die Produktdatenbank antwortet gerade nicht. Bitte gleich noch einmal scannen.'
                 : 'Die Produktdatenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.',
        ['source' => $e->source()]
    );
} catch (\Throwable $e) {
    error_log('[saisonovo] ' . $e);
    saisonovo_error(500, 'internal_error', 'Interner Fehler im Saisonovo-Backend.');
}

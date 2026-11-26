<?php
/**
 * Gemeinsamer Start für alle Endpunkte: Autoloader, Konfiguration, Hilfsfunktionen für JSON-Antworten.
 * Keine externen Abhängigkeiten – nur PHP ≥ 8.0 mit den Erweiterungen curl und json.
 */
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Saisonovo\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

/** @return array<string,mixed> */
function saisonovo_config(): array
{
    static $config = null;
    return $config ??= require __DIR__ . '/config.php';
}

function saisonovo_send_cors(array $config): void
{
    header('Access-Control-Allow-Origin: ' . $config['cors_origin']);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}

/** @param array<string,mixed> $payload */
function saisonovo_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function saisonovo_error(int $status, string $code, string $message, array $extra = []): never
{
    saisonovo_json($status, ['status' => 0, 'error' => ['code' => $code, 'message' => $message]] + $extra);
}

/**
 * Baut den ProductService mit den konfigurierten Bausteinen zusammen.
 * Hier – und nur hier – wird entschieden, welcher Speicher und welche Preisquellen genutzt werden.
 * Neue Preis-API: Klasse in src/Source anlegen und unten in $priceSources eintragen.
 * Umstieg auf SQLite/MySQL: JsonFileProductRepository durch eine eigene ProductRepository-Klasse ersetzen.
 */
function saisonovo_service(): \Saisonovo\Service\ProductService
{
    $c = saisonovo_config();
    $http = new \Saisonovo\Http\HttpClient($c['user_agent'], $c['http']['connect_timeout'], $c['http']['timeout']);
    $s = $c['sources'];

    $priceSources = [
        new \Saisonovo\Source\OpenPricesSource(
            $http, $s['open_prices']['base_url'], (int) $s['open_prices']['page_size'], (bool) $s['open_prices']['enabled'],
        ),
        new \Saisonovo\Source\PepestoReweSource($http, $s['pepesto_rewe']),
        new \Saisonovo\Source\ApifyReweSource($http, $s['apify_rewe']),
        new \Saisonovo\Source\PreiszeigerSource($http, $s['preiszeiger']),
    ];

    return new \Saisonovo\Service\ProductService(
        new \Saisonovo\Repository\JsonFileProductRepository($c['data_dir']),
        new \Saisonovo\Source\OpenFoodFactsSource($http, $s['openfoodfacts']['base_url']),
        $priceSources,
        $c['ttl'],
        $c['prices'],
    );
}

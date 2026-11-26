<?php
declare(strict_types=1);

namespace Saisonovo\Http;

use Saisonovo\Support\Exception\SourceException;

/**
 * Schlanker HTTP-Client auf Basis von cURL (PHP-Standard, keine Abhängigkeiten).
 * Setzt immer den App-User-Agent, wertet JSON aus und übersetzt Netzwerkfehler in SourceException.
 */
class HttpClient
{
    public function __construct(
        private readonly string $userAgent,
        private readonly int $connectTimeout = 4,
        private readonly int $timeout = 8,
    ) {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('Die PHP-Erweiterung cURL ist nicht installiert.');
        }
    }

    /**
     * GET-Anfrage mit JSON-Antwort.
     *
     * @param array<string,string> $headers
     * @param int[] $acceptStatus  Statuscodes, die nicht als Fehler gelten (z. B. 404 bei "nicht gefunden")
     */
    public function getJson(string $url, array $headers = [], array $acceptStatus = [200], ?int $timeout = null): HttpResponse
    {
        return $this->request('GET', $url, null, $headers, $acceptStatus, $timeout);
    }

    /**
     * POST mit JSON-Body.
     *
     * @param array<string,mixed> $body
     * @param array<string,string> $headers
     * @param int[] $acceptStatus
     */
    public function postJson(string $url, array $body, array $headers = [], array $acceptStatus = [200, 201], ?int $timeout = null): HttpResponse
    {
        $headers['Content-Type'] = 'application/json';
        return $this->request('POST', $url, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $headers, $acceptStatus, $timeout);
    }

    /**
     * @param array<string,string> $headers
     * @param int[] $acceptStatus
     */
    private function request(string $method, string $url, string|array|null $body, array $headers, array $acceptStatus, ?int $timeout = null): HttpResponse
    {
        $ch = curl_init($url);
        $headerLines = ['Accept: application/json'];
        foreach ($headers as $k => $v) {
            $headerLines[] = "{$k}: {$v}";
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
            CURLOPT_TIMEOUT        => $timeout ?? $this->timeout,   // z. B. länger für große Kataloge
            CURLOPT_USERAGENT      => $this->userAgent,
            CURLOPT_HTTPHEADER     => $headerLines,
            CURLOPT_ENCODING       => '',            // gzip/deflate annehmen
            CURLOPT_CUSTOMREQUEST  => $method,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        $host = parse_url($url, PHP_URL_HOST) ?: 'externe API';   // nie die volle URL (kann Tokens enthalten)
        if ($errno !== 0) {
            $timeout = in_array($errno, [CURLE_OPERATION_TIMEDOUT, 28], true);
            throw new SourceException(
                $timeout ? "Zeitüberschreitung bei {$host}." : "Verbindung zu {$host} fehlgeschlagen ({$error}).",
                $host,
                $timeout,
            );
        }
        if (!in_array($status, $acceptStatus, true)) {
            throw new SourceException("{$host} antwortete mit HTTP {$status}.", $host, false, $status);
        }

        $data = null;
        if ($raw !== '' && $raw !== false) {
            $data = json_decode((string) $raw, true);
            if (!is_array($data)) {
                throw new SourceException("{$host} lieferte keine gültige JSON-Antwort.", $host, false, $status);
            }
        }
        return new HttpResponse($status, $data ?? []);
    }
}

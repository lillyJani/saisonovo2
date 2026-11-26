<?php
declare(strict_types=1);

namespace Saisonovo\Repository;

/**
 * Einfacher Schlüssel-Wert-Speicher als JSON-Dateien (Supermarkt-Kataloge, laufende Apify-Abfragen).
 * Bei einem Umstieg auf SQLite/MySQL lässt er sich wie das ProductRepository ersetzen.
 */
final class JsonFileStore
{
    public function __construct(private readonly string $dir)
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0775, true) && !is_dir($this->dir)) {
            throw new \RuntimeException("Ordner {$this->dir} kann nicht angelegt werden.");
        }
    }

    /** @return array<mixed>|null */
    public function get(string $key): ?array
    {
        $f = $this->path($key);
        if (!is_file($f)) {
            return null;
        }
        $d = json_decode((string) @file_get_contents($f), true);
        return is_array($d) ? $d : null;
    }

    /** @param array<mixed> $data */
    public function put(string $key, array $data): void
    {
        $f = $this->path($key);
        $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        if ($json === false || file_put_contents($tmp, $json) === false || !rename($tmp, $f)) {
            @unlink($tmp);
            throw new \RuntimeException("Speichern von {$key} fehlgeschlagen.");
        }
    }

    public function delete(string $key): void
    {
        @unlink($this->path($key));
    }

    private function path(string $key): string
    {
        return rtrim($this->dir, '/') . '/' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $key) . '.json';
    }
}

<?php
declare(strict_types=1);

namespace Saisonovo\Repository;

/**
 * JSON-Cache mit einer Datei pro EAN: data/products/<ean>.json
 *
 * - Lesen mit geteilter Sperre, Schreiben atomar (temporäre Datei + rename) unter exklusiver Sperre,
 *   damit parallele Scans sich nicht gegenseitig Dateien zerstören.
 * - Dateinamen bestehen nur aus Ziffern (EAN wird vorher geprüft) – kein Pfad-Trick möglich.
 */
final class JsonFileProductRepository implements ProductRepository
{
    public function __construct(private readonly string $dir)
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0775, true) && !is_dir($this->dir)) {
            throw new \RuntimeException("Cache-Ordner {$this->dir} kann nicht angelegt werden.");
        }
    }

    public function find(string $ean): ?array
    {
        $file = $this->path($ean);
        if (!is_file($file)) {
            return null;
        }
        $fh = @fopen($file, 'rb');
        if ($fh === false) {
            return null;
        }
        try {
            flock($fh, LOCK_SH);
            $json = stream_get_contents($fh);
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
        $data = json_decode((string) $json, true);
        return is_array($data) ? $data : null;   // kaputte Datei = wie nicht vorhanden behandeln
    }

    public function save(string $ean, array $record): void
    {
        $file = $this->path($ean);
        $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        if ($json === false) {
            throw new \RuntimeException('Datensatz konnte nicht als JSON gespeichert werden: ' . json_last_error_msg());
        }
        $lock = fopen(rtrim($this->dir, '/') . '/.write.lock', 'c');   // eine gemeinsame Sperrdatei
        if ($lock === false) {
            throw new \RuntimeException("Cache-Datei für {$ean} kann nicht gesperrt werden.");
        }
        try {
            flock($lock, LOCK_EX);
            $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
            if (file_put_contents($tmp, $json . "\n") === false || !rename($tmp, $file)) {
                @unlink($tmp);
                throw new \RuntimeException("Cache-Datei für {$ean} konnte nicht geschrieben werden.");
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function delete(string $ean): void
    {
        @unlink($this->path($ean));
    }

    public function all(): iterable
    {
        foreach (glob($this->dir . '/*.json') ?: [] as $file) {
            $ean = basename($file, '.json');
            if (ctype_digit($ean) && ($rec = $this->find($ean)) !== null) {
                yield $ean => $rec;
            }
        }
    }

    private function path(string $ean): string
    {
        if (!ctype_digit($ean)) {
            throw new \InvalidArgumentException('Ungültige EAN für den Cache.');
        }
        return rtrim($this->dir, '/') . '/' . $ean . '.json';
    }
}

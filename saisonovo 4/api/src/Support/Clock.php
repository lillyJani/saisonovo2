<?php
declare(strict_types=1);

namespace Saisonovo\Support;

/** Austauschbare Zeitquelle – erleichtert Tests der Cache-Laufzeiten. */
class Clock
{
    public function now(): int
    {
        return time();
    }

    public function iso(?int $ts = null): string
    {
        return gmdate('Y-m-d\TH:i:s\Z', $ts ?? $this->now());
    }

    public static function parse(?string $iso): ?int
    {
        if (!$iso) {
            return null;
        }
        $ts = strtotime($iso);
        return $ts === false ? null : $ts;
    }
}

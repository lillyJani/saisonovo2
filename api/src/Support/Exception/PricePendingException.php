<?php
declare(strict_types=1);

namespace Saisonovo\Support\Exception;

/**
 * Eine Preisquelle arbeitet asynchron (z. B. Apify-Lauf gestartet) und hat noch kein Ergebnis.
 * Der ProductService fragt diese Quelle beim nächsten Scan erneut ab, auch wenn die übrigen
 * Preise noch frisch sind.
 */
final class PricePendingException extends SaisonovoException
{
    public function __construct(string $message, private readonly string $source)
    {
        parent::__construct($message);
    }

    public function source(): string
    {
        return $this->source;
    }
}

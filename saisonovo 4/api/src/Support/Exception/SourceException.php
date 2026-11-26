<?php
declare(strict_types=1);

namespace Saisonovo\Support\Exception;

/**
 * Eine externe Datenquelle war nicht erreichbar oder hat Unbrauchbares geliefert.
 * isTimeout() unterscheidet Zeitüberschreitung (→ 504) von sonstigen Fehlern (→ 502).
 */
final class SourceException extends SaisonovoException
{
    public function __construct(
        string $message,
        private readonly string $source = '',
        private readonly bool $timeout = false,
        private readonly ?int $httpStatus = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function source(): string { return $this->source; }
    public function isTimeout(): bool { return $this->timeout; }
    public function httpStatus(): ?int { return $this->httpStatus; }

    public function withSource(string $source): self
    {
        return new self($this->getMessage(), $source, $this->timeout, $this->httpStatus, $this);
    }
}

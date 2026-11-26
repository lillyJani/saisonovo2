<?php
declare(strict_types=1);

namespace Saisonovo\Http;

/** Antwort einer HTTP-Anfrage: Statuscode + ausgewertetes JSON. */
final class HttpResponse
{
    /** @param array<mixed> $data */
    public function __construct(
        public readonly int $status,
        public readonly array $data,
    ) {
    }
}

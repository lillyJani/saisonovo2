<?php
declare(strict_types=1);

namespace Saisonovo\Support\Exception;

/** Ungültige EAN (falsche Länge, keine Ziffern, Prüfziffer falsch) → HTTP 400. */
final class InvalidEanException extends SaisonovoException
{
}

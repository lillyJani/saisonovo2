<?php
declare(strict_types=1);

namespace Saisonovo\Support\Exception;

/** Produkt ist weder im Cache noch bei Open Food Facts bekannt → HTTP 404. */
final class ProductNotFoundException extends SaisonovoException
{
}

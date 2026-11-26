<?php
declare(strict_types=1);

namespace Saisonovo\Service;

/**
 * Fasst Einzelpreise zu einer Übersicht zusammen.
 * Bevorzugt Preise aus dem eingestellten Land (Standard DE) in der eingestellten Währung;
 * gibt es dort keine, werden alle Preise in der Währung genutzt (scope = "all").
 */
final class PriceSummary
{
    /**
     * @param list<array<string,mixed>> $prices
     * @return array<string,mixed>|null
     */
    public static function build(array $prices, string $country, string $currency, int $maxAgeDays, int $now): ?array
    {
        $cutoff = gmdate('Y-m-d', $now - $maxAgeDays * 86400);
        $recent = array_values(array_filter(
            $prices,
            static fn ($p) => ($p['currency'] ?? '') === $currency && ($p['date'] ?? '') >= $cutoff && ($p['price_per'] ?? null) === null
        ));
        if (!$recent) {
            return null;
        }
        $local = array_values(array_filter($recent, static fn ($p) => strtoupper((string) ($p['country_code'] ?? '')) === strtoupper($country)));
        $scope = $local ? strtoupper($country) : 'all';
        $use = $local ?: $recent;

        $values = array_map(static fn ($p) => (float) $p['price'], $use);
        sort($values);
        $n = count($values);
        $median = $n % 2 ? $values[intdiv($n, 2)] : ($values[$n / 2 - 1] + $values[$n / 2]) / 2;
        usort($use, static fn ($a, $b) => strcmp((string) $b['date'], (string) $a['date']));
        $latest = $use[0];

        return [
            'currency'     => $currency,
            'scope'        => $scope,            // "DE" = nur Preise aus Deutschland, "all" = alle Länder
            'count'        => $n,
            'min'          => round($values[0], 2),
            'max'          => round($values[$n - 1], 2),
            'median'       => round($median, 2),
            'avg'          => round(array_sum($values) / $n, 2),
            'latest'       => [
                'price' => $latest['price'], 'date' => $latest['date'], 'store' => $latest['store'] ?? null,
                'city' => $latest['city'] ?? null, 'source' => $latest['source'] ?? null,
            ],
            'sources'      => array_values(array_unique(array_map(static fn ($p) => (string) $p['source'], $use))),
            'since'        => $cutoff,
        ];
    }
}

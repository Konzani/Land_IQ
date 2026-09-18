'use client'

import type { ParcelAnalysis } from '../lib/spatial/types'

interface Row {
  label: string
  value: string
  hint?: string
}

function num(v: number | null | undefined, digits = 1, unit = ''): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}${unit}`
}

export function buildIndicatorGroups(analysis: ParcelAnalysis): { title: string; source: string; rows: Row[] }[] {
  const groups: { title: string; source: string; rows: Row[] }[] = []
  const { soil, terrain, climate } = analysis

  if (soil) {
    groups.push({
      title: 'Soil',
      source: soil.source,
      rows: [
        { label: 'Reaction', value: num(soil.ph, 1, ' pH') },
        { label: 'Texture', value: soil.textureClass ?? '—' },
        { label: 'Drainage', value: soil.drainage ?? '—', hint: 'inferred from particle size' },
        { label: 'Organic carbon', value: num(soil.organicCarbonPct, 2, '%') },
        { label: 'Total nitrogen', value: num(soil.nitrogenPct, 2, '%') },
        { label: 'Cation exchange', value: num(soil.cec, 1, ' cmol/kg') },
      ],
    })
  }

  if (terrain) {
    groups.push({
      title: 'Terrain',
      source: terrain.source,
      rows: [
        { label: 'Mean elevation', value: num(terrain.elevation.mean, 0, ' m') },
        {
          label: 'Elevation range',
          value: `${num(terrain.elevation.min, 0)} – ${num(terrain.elevation.max, 0, ' m')}`,
        },
        { label: 'Mean slope', value: num(terrain.slopeDeg.mean, 1, '°') },
        { label: 'Steepest slope', value: num(terrain.slopeDeg.max, 1, '°') },
        { label: 'Aspect', value: terrain.dominantAspect },
        { label: 'Sample points', value: String(terrain.samples) },
      ],
    })
  }

  if (climate) {
    groups.push({
      title: 'Climate',
      source: climate.source,
      rows: [
        { label: 'Annual rainfall', value: num(climate.annualRainfallMm, 0, ' mm') },
        { label: 'Pattern', value: climate.rainfallPattern },
        { label: 'Long rains, Mar–May', value: num(climate.longRainsMm, 0, ' mm') },
        { label: 'Short rains, Oct–Dec', value: num(climate.shortRainsMm, 0, ' mm') },
        { label: 'Dry months', value: `${climate.dryMonths} of 12`, hint: 'under 60 mm' },
        { label: 'Mean temperature', value: num(climate.meanTempC, 1, ' °C') },
        { label: 'Lowest recorded', value: num(climate.absMinTempC, 1, ' °C') },
        { label: 'Growing degree days', value: num(climate.gddBase10, 0), hint: 'base 10 °C' },
      ],
    })
  }

  return groups
}

export default function IndicatorTable({ analysis }: { analysis: ParcelAnalysis }) {
  const groups = buildIndicatorGroups(analysis)
  if (!groups.length) return null

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="font-sheet text-lg text-ink">{group.title}</h3>
          <dl className="mt-2">
            {group.rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-rule/50 py-1.5">
                <dt className="text-sm text-ink-soft">
                  {row.label}
                  {row.hint && <span className="label-note"> · {row.hint}</span>}
                </dt>
                <dd className="text-sm text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="label-note mt-2">{group.source}</p>
        </section>
      ))}
    </div>
  )
}

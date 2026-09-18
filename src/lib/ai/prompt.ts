import type { ParcelAnalysis } from '../spatial/types'
import type { CropAssessment } from '../agronomy/suitability'
import { CLASS_LABEL } from '../agronomy/suitability'

const n = (v: number | null | undefined, digits = 1, unit = '') =>
  v == null || !Number.isFinite(v) ? 'not available' : `${v.toFixed(digits)}${unit}`

export const SYSTEM_PROMPT = `You are a land evaluation specialist writing the interpretation section of a formal agricultural feasibility report for a site in Kenya.

Rules you must follow:
- Every number in the measured data block has already been computed from satellite and reanalysis datasets. Use those figures exactly. Never invent, round differently, or estimate a value that is not given.
- The suitability scores and classes were produced by a deterministic FAO-style scoring engine. Do not overturn them. Your job is to explain why the ranking came out the way it did and what a grower should do about it.
- Where a value is marked "not available", say the assessment is limited by that gap rather than filling it in.
- Write for a landowner or investor who is not an agronomist: plain sentences, no jargon left unexplained, no marketing tone.
- Kenyan context matters: reference the long rains and short rains by name where the rainfall pattern warrants it, and stay realistic about smallholder capital.
- Use British spelling and metric units.`

export function buildUserPrompt(analysis: ParcelAnalysis, ranked: CropAssessment[]): string {
  const { parcel, terrain, soil, climate } = analysis
  const [lon, lat] = parcel.centroid
  const top = ranked.slice(0, 6)

  const rankingBlock = top
    .map((a, i) => {
      const limits = a.limiting.length
        ? a.limiting.map((f) => `${f.factor} ${f.direction} requirement (${f.observed}, needs ${f.required})`).join('; ')
        : 'no factor scored below 70'
      return `${i + 1}. ${a.crop.name} — score ${a.score}/100, class ${a.class} (${CLASS_LABEL[a.class]}). Limiting factors: ${limits}.`
    })
    .join('\n')

  const rejected = ranked
    .filter((a) => a.class === 'N')
    .slice(0, 4)
    .map((a) => `${a.crop.name} (${a.limiting[0]?.factor ?? 'multiple factors'})`)
    .join(', ')

  return `MEASURED DATA

Parcel
- Reference: ${analysis.reference}
- Area: ${parcel.areaHa.toFixed(2)} ha (${parcel.areaAcres.toFixed(2)} acres)
- Perimeter: ${Math.round(parcel.perimeterM)} m
- Centroid: ${lat.toFixed(5)}, ${lon.toFixed(5)}

Terrain${terrain ? '' : ': not available'}
${
  terrain
    ? `- Mean elevation: ${n(terrain.elevation.mean, 0, ' m')} (range ${n(terrain.elevation.min, 0)}\u2013${n(terrain.elevation.max, 0, ' m')})
- Mean slope: ${n(terrain.slopeDeg.mean, 1, '\u00b0')}, maximum ${n(terrain.slopeDeg.max, 1, '\u00b0')}
- Relief: ${n(terrain.relief, 0, ' m')}; dominant aspect ${terrain.dominantAspect}
- Source: ${terrain.source}`
    : ''
}

Soil${soil ? '' : ': not available'}
${
  soil
    ? `- pH (water): ${n(soil.ph, 1)}
- Organic carbon: ${n(soil.organicCarbonPct, 2, '%')}
- Total nitrogen: ${n(soil.nitrogenPct, 2, '%')}
- Texture: ${soil.textureClass ?? 'not available'} (clay ${n(soil.clayPct, 0, '%')}, sand ${n(soil.sandPct, 0, '%')}, silt ${n(soil.siltPct, 0, '%')})
- Cation exchange capacity: ${n(soil.cec, 1, ' cmol(c)/kg')}
- Inferred drainage: ${soil.drainage ?? 'not available'}
- Source: ${soil.source}`
    : ''
}

Climate${climate ? '' : ': not available'}
${
  climate
    ? `- Mean annual rainfall: ${n(climate.annualRainfallMm, 0, ' mm')} over ${climate.yearsAnalysed} years
- Rainfall pattern: ${climate.rainfallPattern}; long rains (Mar\u2013May) ${n(climate.longRainsMm, 0, ' mm')}, short rains (Oct\u2013Dec) ${n(climate.shortRainsMm, 0, ' mm')}
- Dry months (under 60 mm): ${climate.dryMonths} of 12
- Mean temperature: ${n(climate.meanTempC, 1, ' \u00b0C')} (mean max ${n(climate.meanTMaxC, 1)}, mean min ${n(climate.meanTMinC, 1)})
- Lowest recorded temperature: ${n(climate.absMinTempC, 1, ' \u00b0C')}; frost days per year ${n(climate.frostDaysPerYear, 1)}
- Growing degree days above 10 \u00b0C: ${n(climate.gddBase10, 0)}
- Source: ${climate.source}`
    : ''
}

ENGINE RANKING
${rankingBlock}
${rejected ? `\nRuled out by the engine: ${rejected}.` : ''}

WRITE THE FOLLOWING SECTIONS IN MARKDOWN, USING THESE EXACT HEADINGS

## Site character
Two or three sentences describing what kind of land this is, drawn only from the measured data.

## Why the ranking came out this way
Explain the leading crop and the reason the next contenders sit below it. Name the specific factor that separates them.

## Recommended cropping plan
A primary crop and one complementary or rotation crop, with the season each should be planted in given the rainfall pattern, and the approximate area split for a parcel of this size.

## What to fix before planting
Concrete interventions tied to the limiting factors above. Give quantities or specifications where the data supports it.

## Limits of this assessment
State plainly what a modelled desktop assessment cannot tell them, and which of the measured values most needs confirming with a physical soil test.`
}

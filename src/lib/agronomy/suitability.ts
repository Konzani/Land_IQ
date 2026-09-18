import { CROPS, type Crop, type Range } from './crops'
import type { ParcelAnalysis } from '../spatial/types'

export type SuitabilityClass = 'S1' | 'S2' | 'S3' | 'N'

export interface FactorScore {
  factor: string
  score: number
  observed: string
  required: string
  direction: 'below' | 'above' | 'within'
}

export interface CropAssessment {
  crop: Crop
  score: number
  class: SuitabilityClass
  factors: FactorScore[]
  limiting: FactorScore[]
  interventions: string[]
  confidence: 'high' | 'moderate' | 'low'
}

export const CLASS_LABEL: Record<SuitabilityClass, string> = {
  S1: 'Highly suitable',
  S2: 'Moderately suitable',
  S3: 'Marginally suitable',
  N: 'Not suitable',
}

function rampScore(value: number, range: Range): { score: number; direction: FactorScore['direction'] } {
  const { absMin, optMin, optMax, absMax } = range
  if (value >= optMin && value <= optMax) return { score: 100, direction: 'within' }
  if (value < absMin) return { score: 0, direction: 'below' }
  if (value > absMax) return { score: 0, direction: 'above' }
  if (value < optMin) {
    const span = Math.max(optMin - absMin, 1e-6)
    return { score: ((value - absMin) / span) * 100, direction: 'below' }
  }
  const span = Math.max(absMax - optMax, 1e-6)
  return { score: ((absMax - value) / span) * 100, direction: 'above' }
}

function classify(score: number): SuitabilityClass {
  if (score >= 80) return 'S1'
  if (score >= 60) return 'S2'
  if (score >= 40) return 'S3'
  return 'N'
}

const fmtRange = (range: Range, unit: string) =>
  `${range.optMin}\u2013${range.optMax} ${unit} optimum (${range.absMin}\u2013${range.absMax} tolerated)`

function interventionsFor(crop: Crop, limiting: FactorScore[]): string[] {
  const out: string[] = []
  for (const f of limiting) {
    if (f.factor === 'Soil reaction' && f.direction === 'below')
      out.push('Apply agricultural lime to raise pH; split the rate over two seasons and re-test after the first.')
    if (f.factor === 'Soil reaction' && f.direction === 'above')
      out.push('Use elemental sulphur or ammonium-based fertiliser to acidify; confirm sodicity before treating.')
    if (f.factor === 'Rainfall' && f.direction === 'below')
      out.push('Size a drip system for the seasonal deficit and add a storage pan or borehole to cover it.')
    if (f.factor === 'Rainfall' && f.direction === 'above')
      out.push('Prioritise raised beds, cut-off drains and a disease-resistant variety.')
    if (f.factor === 'Mean temperature' && f.direction === 'below')
      out.push('Consider tunnel or shade-net production to lift effective growing temperature.')
    if (f.factor === 'Mean temperature' && f.direction === 'above')
      out.push('Shift planting into the cooler season or use shade netting to cut canopy temperature.')
    if (f.factor === 'Slope') out.push('Terrace or plant on the contour, with grass strips to hold soil on the steeper faces.')
    if (f.factor === 'Altitude')
      out.push('Substitute a variety bred for this altitude band rather than adjusting the site.')
    if (f.factor === 'Drainage')
      out.push('Install subsurface drainage or raised planting stations before establishing.')
  }
  if (crop.drainageSensitivity === 'high' && !out.some((s) => s.includes('drain')))
    out.push('Dig a test pit to confirm effective rooting depth before committing capital.')
  return Array.from(new Set(out)).slice(0, 4)
}

export function assessCrop(crop: Crop, analysis: ParcelAnalysis): CropAssessment | null {
  const { soil, terrain, climate } = analysis
  const factors: FactorScore[] = []

  if (soil?.ph != null) {
    const { score, direction } = rampScore(soil.ph, crop.ph)
    factors.push({
      factor: 'Soil reaction',
      score,
      observed: `pH ${soil.ph.toFixed(1)}`,
      required: fmtRange(crop.ph, 'pH'),
      direction,
    })
  }

  if (terrain) {
    const elev = terrain.elevation.mean
    const { score, direction } = rampScore(elev, crop.altitudeM)
    factors.push({
      factor: 'Altitude',
      score,
      observed: `${Math.round(elev)} m`,
      required: fmtRange(crop.altitudeM, 'm'),
      direction,
    })

    const slope = terrain.slopeDeg.mean
    const slopeScore = slope <= crop.maxSlopeDeg * 0.5 ? 100 : slope >= crop.maxSlopeDeg * 1.5 ? 0 : 100 * (1 - (slope - crop.maxSlopeDeg * 0.5) / crop.maxSlopeDeg)
    factors.push({
      factor: 'Slope',
      score: Math.max(0, Math.min(100, slopeScore)),
      observed: `${slope.toFixed(1)}\u00b0 mean`,
      required: `under ${crop.maxSlopeDeg}\u00b0 without earthworks`,
      direction: slope > crop.maxSlopeDeg ? 'above' : 'within',
    })
  }

  if (climate) {
    const rain = rampScore(climate.annualRainfallMm, crop.rainfallMm)
    factors.push({
      factor: 'Rainfall',
      score: rain.score,
      observed: `${Math.round(climate.annualRainfallMm)} mm/yr`,
      required: fmtRange(crop.rainfallMm, 'mm'),
      direction: rain.direction,
    })

    const temp = rampScore(climate.meanTempC, crop.meanTempC)
    factors.push({
      factor: 'Mean temperature',
      score: temp.score,
      observed: `${climate.meanTempC.toFixed(1)} \u00b0C`,
      required: fmtRange(crop.meanTempC, '\u00b0C'),
      direction: temp.direction,
    })

    const margin = climate.meanTMinC - crop.coldLimitC
    const base = margin >= 3 ? 100 : margin <= -4 ? 0 : ((margin + 4) / 7) * 100
    const frostPenalty = climate.frostDaysPerYear > 1 && crop.coldLimitC >= 7 ? 35 : 0
    factors.push({
      factor: 'Cold exposure',
      score: Math.max(0, base - frostPenalty),
      observed: `${climate.meanTMinC.toFixed(1)} \u00b0C mean nightly low, ${climate.absMinTempC.toFixed(1)} \u00b0C extreme`,
      required: `nights above ${crop.coldLimitC} \u00b0C`,
      direction: margin < 0 || frostPenalty ? 'below' : 'within',
    })
  }

  if (soil?.drainage) {
    const table: Record<string, Record<string, number>> = {
      high: { poor: 10, moderate: 60, good: 100 },
      moderate: { poor: 40, moderate: 80, good: 100 },
      low: { poor: 65, moderate: 90, good: 100 },
    }
    factors.push({
      factor: 'Drainage',
      score: table[crop.drainageSensitivity][soil.drainage],
      observed: `${soil.drainage} drainage${soil.textureClass ? ` (${soil.textureClass})` : ''}`,
      required: `${crop.drainageSensitivity === 'high' ? 'free' : 'adequate'} drainage`,
      direction: soil.drainage === 'poor' ? 'below' : 'within',
    })
  }

  if (factors.length < 3) return null

  const scores = factors.map((f) => f.score)
  const minScore = Math.min(...scores)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const combined = minScore === 0 ? Math.min(25, mean * 0.25) : 0.55 * minScore + 0.45 * mean

  const limiting = factors.filter((f) => f.score < 70).sort((a, b) => a.score - b.score)
  const expected = 8
  const confidence = factors.length >= expected - 1 ? 'high' : factors.length >= 5 ? 'moderate' : 'low'

  return {
    crop,
    score: Math.round(combined),
    class: classify(combined),
    factors,
    limiting,
    interventions: interventionsFor(crop, limiting),
    confidence,
  }
}

export function rankCrops(analysis: ParcelAnalysis): CropAssessment[] {
  return CROPS.map((c) => assessCrop(c, analysis))
    .filter((a): a is CropAssessment => a !== null)
    .sort((a, b) => b.score - a.score)
}

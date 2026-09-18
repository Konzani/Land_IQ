import type { Parcel, ZonalStats } from './geometry'

export interface TerrainMetrics {
  elevation: ZonalStats
  slopeDeg: ZonalStats
  relief: number
  dominantAspect: string
  samples: number
  source: string
}

export interface SoilMetrics {
  ph: number | null
  organicCarbonPct: number | null
  clayPct: number | null
  sandPct: number | null
  siltPct: number | null
  nitrogenPct: number | null
  cec: number | null
  textureClass: string | null
  drainage: 'poor' | 'moderate' | 'good' | null
  samples: number
  source: string
}

export interface MonthlyClimate {
  month: number
  rainfallMm: number
  tMaxC: number
  tMinC: number
}

export interface ClimateMetrics {
  annualRainfallMm: number
  meanTempC: number
  meanTMaxC: number
  meanTMinC: number
  absMinTempC: number
  frostDaysPerYear: number
  gddBase10: number
  dryMonths: number
  wettestMonth: number
  longRainsMm: number
  shortRainsMm: number
  rainfallPattern: 'bimodal' | 'unimodal' | 'aseasonal'
  monthly: MonthlyClimate[]
  yearsAnalysed: number
  source: string
}

export interface ParcelAnalysis {
  parcel: Parcel
  terrain: TerrainMetrics | null
  soil: SoilMetrics | null
  climate: ClimateMetrics | null
  generatedAt: string
  reference: string
}

export type WorkerStage = 'geometry' | 'terrain' | 'soil' | 'climate' | 'scoring'

export type WorkerMessage =
  | { type: 'progress'; stage: WorkerStage; label: string }
  | { type: 'warning'; stage: WorkerStage; message: string }
  | { type: 'complete'; analysis: ParcelAnalysis }
  | { type: 'failed'; message: string }

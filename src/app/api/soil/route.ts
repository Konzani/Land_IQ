import { NextResponse } from 'next/server'
import { readCache, writeCache } from '../../../lib/supabase/server'
import type { SoilMetrics } from '../../../lib/spatial/types'

const ENDPOINT = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
const PROPERTIES = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'nitrogen', 'cec']
const DEPTHS = ['0-5cm', '5-15cm', '15-30cm']
const CACHE_MS = 1000 * 60 * 60 * 24 * 180

interface IsricLayer {
  name: string
  unit_measure?: { d_factor?: number }
  depths?: { label: string; values?: Record<string, number | null> }[]
}

function mean(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function textureClass(clay: number, sand: number, silt: number): string {
  if (clay >= 40) return sand >= 45 ? 'sandy clay' : silt >= 40 ? 'silty clay' : 'clay'
  if (clay >= 27) return sand >= 45 ? 'sandy clay loam' : silt >= 28 ? 'silty clay loam' : 'clay loam'
  if (sand >= 85) return 'sand'
  if (sand >= 70) return 'loamy sand'
  if (silt >= 80) return 'silt'
  if (silt >= 50) return 'silt loam'
  if (sand >= 43 && clay < 20) return 'sandy loam'
  return 'loam'
}

function drainageOf(clay: number, sand: number): SoilMetrics['drainage'] {
  if (sand >= 65 || clay < 18) return 'good'
  if (clay >= 40) return 'poor'
  return 'moderate'
}

async function queryPoint(lon: number, lat: number) {
  const params = new URLSearchParams()
  params.set('lon', lon.toFixed(5))
  params.set('lat', lat.toFixed(5))
  PROPERTIES.forEach((p) => params.append('property', p))
  DEPTHS.forEach((d) => params.append('depth', d))
  params.append('value', 'mean')

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`SoilGrids returned ${res.status}`)
  const json = (await res.json()) as { properties?: { layers?: IsricLayer[] } }

  const out: Record<string, number> = {}
  for (const layer of json.properties?.layers ?? []) {
    const factor = layer.unit_measure?.d_factor ?? 1
    const values = (layer.depths ?? [])
      .map((d) => d.values?.mean)
      .filter((n): n is number => typeof n === 'number')
      .map((n) => n / factor)
    const m = mean(values)
    if (m !== null) out[layer.name] = m
  }
  return out
}

export async function POST(req: Request) {
  let body: { points?: [number, number][] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with a points array.' }, { status: 400 })
  }

  const points = (body.points ?? []).slice(0, 5)
  if (!points.length) {
    return NextResponse.json({ error: 'No sample points supplied.' }, { status: 400 })
  }

  const cacheKey = points
    .map(([lon, lat]) => `${lon.toFixed(2)},${lat.toFixed(2)}`)
    .sort()
    .join('|')

  const cached = await readCache<SoilMetrics>('soil_cache', cacheKey, CACHE_MS)
  if (cached) return NextResponse.json(cached)

  const results: Record<string, number>[] = []
  for (const [lon, lat] of points) {
    try {
      results.push(await queryPoint(lon, lat))
    } catch {
      // A single failed sample should not sink the whole read.
    }
  }

  if (!results.length) {
    return NextResponse.json({ error: 'SoilGrids did not return data for this parcel.' }, { status: 502 })
  }

  const pick = (key: string) => mean(results.map((r) => r[key]).filter((n): n is number => n != null))

  const clay = pick('clay')
  const sand = pick('sand')
  const silt = pick('silt')

  const metrics: SoilMetrics = {
    ph: pick('phh2o'),
    organicCarbonPct: (() => {
      const soc = pick('soc')
      return soc == null ? null : soc / 10
    })(),
    clayPct: clay,
    sandPct: sand,
    siltPct: silt,
    nitrogenPct: (() => {
      const n = pick('nitrogen')
      return n == null ? null : n / 10
    })(),
    cec: pick('cec'),
    textureClass: clay != null && sand != null && silt != null ? textureClass(clay, sand, silt) : null,
    drainage: clay != null && sand != null ? drainageOf(clay, sand) : null,
    samples: results.length,
    source: 'ISRIC SoilGrids v2.0, 0-30 cm weighted mean',
  }

  await writeCache('soil_cache', cacheKey, metrics)
  return NextResponse.json(metrics)
}

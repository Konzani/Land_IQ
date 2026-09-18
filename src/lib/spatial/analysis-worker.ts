import { describeParcel, buildSampleGrid, pointInRing, type Ring } from './geometry'
import { analyseTerrain } from './terrain'
import type { ClimateMetrics, ParcelAnalysis, SoilMetrics, WorkerMessage } from './types'

const post = (msg: WorkerMessage) => self.postMessage(msg)

function referenceFor(centroid: [number, number]): string {
  const [lon, lat] = centroid
  const band = String.fromCharCode(65 + Math.floor(((lat + 90) / 180) * 26))
  const zone = Math.floor((lon + 180) / 6) + 1
  const serial = Math.abs(Math.round(lat * 10000) % 9973)
  return `LIQ-${zone}${band}-${String(serial).padStart(4, '0')}`
}

function soilSamplePoints(ring: Ring, centroid: [number, number]): [number, number][] {
  const grid = buildSampleGrid(ring, 25)
  const inside = grid.points.filter((p) => pointInRing(p, ring))
  const pool = inside.length >= 4 ? inside : grid.points
  const step = Math.max(1, Math.floor(pool.length / 4))
  const picks: [number, number][] = [centroid]
  for (let i = 0; i < pool.length && picks.length < 5; i += step) picks.push(pool[i])
  return picks
}

self.onmessage = async (event: MessageEvent<{ ring: Ring }>) => {
  const ring = event.data?.ring
  if (!ring || ring.length < 3) {
    post({ type: 'failed', message: 'The drawn boundary needs at least three points.' })
    return
  }

  try {
    post({ type: 'progress', stage: 'geometry', label: 'Computing parcel geometry' })
    const parcel = describeParcel(ring)

    if (parcel.areaHa < 0.01) {
      post({ type: 'failed', message: 'That parcel is smaller than 100 m2. Draw a larger boundary.' })
      return
    }

    post({ type: 'progress', stage: 'terrain', label: 'Sampling elevation and deriving slope' })
    let terrain = null
    try {
      terrain = await analyseTerrain(ring)
    } catch (err) {
      post({ type: 'warning', stage: 'terrain', message: readMessage(err) })
    }

    post({ type: 'progress', stage: 'soil', label: 'Querying soil profile' })
    let soil: SoilMetrics | null = null
    try {
      const res = await fetch('/api/soil', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ points: soilSamplePoints(ring, parcel.centroid) }),
      })
      if (!res.ok) throw new Error(await readError(res))
      soil = (await res.json()) as SoilMetrics
    } catch (err) {
      post({ type: 'warning', stage: 'soil', message: readMessage(err) })
    }

    post({ type: 'progress', stage: 'climate', label: 'Building ten-year climate normals' })
    let climate: ClimateMetrics | null = null
    try {
      const [lon, lat] = parcel.centroid
      const res = await fetch(`/api/climate?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
      if (!res.ok) throw new Error(await readError(res))
      climate = (await res.json()) as ClimateMetrics
    } catch (err) {
      post({ type: 'warning', stage: 'climate', message: readMessage(err) })
    }

    if (!terrain && !soil && !climate) {
      post({ type: 'failed', message: 'No environmental data could be retrieved for this parcel.' })
      return
    }

    const analysis: ParcelAnalysis = {
      parcel,
      terrain,
      soil,
      climate,
      generatedAt: new Date().toISOString(),
      reference: referenceFor(parcel.centroid),
    }

    post({ type: 'progress', stage: 'scoring', label: 'Scoring crop suitability' })
    post({ type: 'complete', analysis })
  } catch (err) {
    post({ type: 'failed', message: readMessage(err) })
  }
}

function readMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected failure during analysis.'
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? `Request failed with status ${res.status}`
  } catch {
    return `Request failed with status ${res.status}`
  }
}

export {}

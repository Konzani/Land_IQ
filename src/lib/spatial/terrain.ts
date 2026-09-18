import { buildSampleGrid, pointInRing, zonalStats, type Ring } from './geometry'
import type { TerrainMetrics } from './types'

const ELEVATION_ENDPOINT = 'https://api.open-meteo.com/v1/elevation'
const MAX_POINTS_PER_CALL = 100

async function fetchElevations(points: [number, number][]): Promise<number[]> {
  const out: number[] = []
  for (let i = 0; i < points.length; i += MAX_POINTS_PER_CALL) {
    const batch = points.slice(i, i + MAX_POINTS_PER_CALL)
    const lat = batch.map((p) => p[1].toFixed(6)).join(',')
    const lon = batch.map((p) => p[0].toFixed(6)).join(',')
    const res = await fetch(`${ELEVATION_ENDPOINT}?latitude=${lat}&longitude=${lon}`)
    if (!res.ok) throw new Error(`Elevation service returned ${res.status}`)
    const json = (await res.json()) as { elevation?: number[] }
    if (!Array.isArray(json.elevation)) throw new Error('Elevation service returned no data')
    out.push(...json.elevation)
  }
  return out
}

function aspectLabel(deg: number): string {
  const names = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west']
  return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

export async function analyseTerrain(ring: Ring): Promise<TerrainMetrics> {
  const grid = buildSampleGrid(ring, 96)
  const elevations = await fetchElevations(grid.points)

  const inside = grid.points.map((p) => pointInRing(p, ring))
  const insideElevations = grid.points
    .map((_, i) => (inside[i] ? elevations[i] : NaN))
    .filter((n) => Number.isFinite(n))

  const elevationStats =
    zonalStats(insideElevations.length >= 3 ? insideElevations : elevations) ?? {
      mean: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      count: 0,
    }

  const at = (c: number, r: number) => elevations[r * grid.cols + c]
  const spacing = Math.max(grid.spacingM, 1)
  const slopes: number[] = []
  let sinSum = 0
  let cosSum = 0

  for (let r = 1; r < grid.rows - 1; r++) {
    for (let c = 1; c < grid.cols - 1; c++) {
      if (!inside[r * grid.cols + c]) continue
      const dzdx =
        (at(c + 1, r - 1) + 2 * at(c + 1, r) + at(c + 1, r + 1) -
          (at(c - 1, r - 1) + 2 * at(c - 1, r) + at(c - 1, r + 1))) /
        (8 * spacing)
      const dzdy =
        (at(c - 1, r + 1) + 2 * at(c, r + 1) + at(c + 1, r + 1) -
          (at(c - 1, r - 1) + 2 * at(c, r - 1) + at(c + 1, r - 1))) /
        (8 * spacing)
      if (!Number.isFinite(dzdx) || !Number.isFinite(dzdy)) continue
      slopes.push((Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI)
      const aspect = (Math.atan2(dzdy, -dzdx) * 180) / Math.PI
      const bearing = (90 - aspect + 360) % 360
      sinSum += Math.sin((bearing * Math.PI) / 180)
      cosSum += Math.cos((bearing * Math.PI) / 180)
    }
  }

  const slopeStats = zonalStats(slopes) ?? { mean: 0, min: 0, max: 0, stdDev: 0, count: 0 }
  const meanBearing = (Math.atan2(sinSum, cosSum) * 180) / Math.PI

  return {
    elevation: elevationStats,
    slopeDeg: slopeStats,
    relief: elevationStats.max - elevationStats.min,
    dominantAspect: slopes.length ? aspectLabel(meanBearing) : 'Undifferentiated',
    samples: grid.points.length,
    source: 'Copernicus DEM GLO-90 via Open-Meteo Elevation API',
  }
}

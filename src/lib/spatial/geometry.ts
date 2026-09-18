export type Ring = [number, number][]

export interface Parcel {
  ring: Ring
  areaHa: number
  areaAcres: number
  perimeterM: number
  centroid: [number, number]
  bbox: [number, number, number, number]
}

const R = 6378137
const F = 1 / 298.257223563
const rad = (d: number) => (d * Math.PI) / 180

function closeRing(ring: Ring): Ring {
  if (ring.length < 3) return ring
  const [f, l] = [ring[0], ring[ring.length - 1]]
  return f[0] === l[0] && f[1] === l[1] ? ring : [...ring, f]
}

export function geodesicAreaM2(ring: Ring): number {
  const r = closeRing(ring)
  if (r.length < 4) return 0
  const e2 = F * (2 - F)
  let total = 0
  for (let i = 0; i < r.length - 1; i++) {
    const [lon1, lat1] = r[i]
    const [lon2, lat2] = r[i + 1]
    const dLon = rad(lon2 - lon1)
    const s1 = Math.sin(rad(lat1))
    const s2 = Math.sin(rad(lat2))
    const q = (a: number) =>
      a / (1 - e2 * a * a) + (1 / (2 * Math.sqrt(e2))) * Math.log((1 + Math.sqrt(e2) * a) / (1 - Math.sqrt(e2) * a))
    total += dLon * (q(s2) + q(s1)) * 0.5
  }
  return Math.abs((total * R * R * (1 - e2)) / 2)
}

export function haversineM(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function perimeterM(ring: Ring): number {
  const r = closeRing(ring)
  let d = 0
  for (let i = 0; i < r.length - 1; i++) d += haversineM(r[i], r[i + 1])
  return d
}

export function bboxOf(ring: Ring): [number, number, number, number] {
  const lons = ring.map((p) => p[0])
  const lats = ring.map((p) => p[1])
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

export function centroidOf(ring: Ring): [number, number] {
  const r = closeRing(ring)
  let x = 0
  let y = 0
  let a = 0
  for (let i = 0; i < r.length - 1; i++) {
    const cross = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    a += cross
    x += (r[i][0] + r[i + 1][0]) * cross
    y += (r[i][1] + r[i + 1][1]) * cross
  }
  if (Math.abs(a) < 1e-12) {
    const bb = bboxOf(ring)
    return [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]
  }
  return [x / (3 * a), y / (3 * a)]
}

export function pointInRing(pt: [number, number], ring: Ring): boolean {
  const r = closeRing(ring)
  let inside = false
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function describeParcel(ring: Ring): Parcel {
  const areaM2 = geodesicAreaM2(ring)
  return {
    ring,
    areaHa: areaM2 / 10000,
    areaAcres: areaM2 / 4046.8564224,
    perimeterM: perimeterM(ring),
    centroid: centroidOf(ring),
    bbox: bboxOf(ring),
  }
}

export interface SampleGrid {
  points: [number, number][]
  cols: number
  rows: number
  origin: [number, number]
  stepLon: number
  stepLat: number
  spacingM: number
}

export function buildSampleGrid(ring: Ring, budget = 90): SampleGrid {
  const [minLon, minLat, maxLon, maxLat] = bboxOf(ring)
  const midLat = (minLat + maxLat) / 2
  const spanLon = Math.max(maxLon - minLon, 1e-5)
  const spanLat = Math.max(maxLat - minLat, 1e-5)
  const aspect = (spanLon * Math.cos(rad(midLat))) / spanLat

  let cols = Math.max(3, Math.round(Math.sqrt(budget * aspect)))
  let rows = Math.max(3, Math.round(budget / cols))
  while (cols * rows > budget && (cols > 3 || rows > 3)) {
    if (cols >= rows && cols > 3) cols--
    else if (rows > 3) rows--
    else break
  }

  const stepLon = spanLon / (cols - 1)
  const stepLat = spanLat / (rows - 1)
  const points: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push([minLon + c * stepLon, minLat + r * stepLat])
    }
  }
  return {
    points,
    cols,
    rows,
    origin: [minLon, minLat],
    stepLon,
    stepLat,
    spacingM: haversineM([minLon, midLat], [minLon + stepLon, midLat]),
  }
}

export interface ZonalStats {
  mean: number
  min: number
  max: number
  stdDev: number
  count: number
}

export function zonalStats(values: number[]): ZonalStats | null {
  const v = values.filter((n) => Number.isFinite(n))
  if (!v.length) return null
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length
  return {
    mean,
    min: Math.min(...v),
    max: Math.max(...v),
    stdDev: Math.sqrt(variance),
    count: v.length,
  }
}

export function formatDMS(value: number, axis: 'lat' | 'lon'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = (minFloat - min) * 60
  return `${deg}\u00b0 ${String(min).padStart(2, '0')}' ${sec.toFixed(1).padStart(4, '0')}" ${hemi}`
}

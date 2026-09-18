import type { Ring } from '../spatial/geometry'
import { bboxOf } from '../spatial/geometry'

const TILE = 256
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z)

function latToY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z)
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
    setTimeout(() => resolve(null), 8000)
  })
}

export interface MapImage {
  dataUrl: string
  width: number
  height: number
}

export async function renderParcelImage(ring: Ring, width = 1000, height = 640): Promise<MapImage | null> {
  if (typeof document === 'undefined' || ring.length < 3) return null

  const [minLon, minLat, maxLon, maxLat] = bboxOf(ring)
  const pad = 0.28

  let zoom = 18
  for (; zoom >= 3; zoom--) {
    const w = (lonToX(maxLon, zoom) - lonToX(minLon, zoom)) * TILE
    const h = (latToY(minLat, zoom) - latToY(maxLat, zoom)) * TILE
    if (w * (1 + pad * 2) <= width && h * (1 + pad * 2) <= height) break
  }
  zoom = Math.max(3, Math.min(18, zoom))

  const centreX = (lonToX(minLon, zoom) + lonToX(maxLon, zoom)) / 2
  const centreY = (latToY(minLat, zoom) + latToY(maxLat, zoom)) / 2
  const originX = centreX * TILE - width / 2
  const originY = centreY * TILE - height / 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#14150F'
  ctx.fillRect(0, 0, width, height)

  const xStart = Math.floor(originX / TILE)
  const xEnd = Math.floor((originX + width) / TILE)
  const yStart = Math.floor(originY / TILE)
  const yEnd = Math.floor((originY + height) / TILE)
  const span = Math.pow(2, zoom)

  const jobs: Promise<void>[] = []
  for (let tx = xStart; tx <= xEnd; tx++) {
    for (let ty = yStart; ty <= yEnd; ty++) {
      if (ty < 0 || ty >= span) continue
      const wrapped = ((tx % span) + span) % span
      const url = TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(wrapped)).replace('{y}', String(ty))
      jobs.push(
        loadTile(url).then((img) => {
          if (img) ctx.drawImage(img, tx * TILE - originX, ty * TILE - originY, TILE, TILE)
        }),
      )
    }
  }
  await Promise.all(jobs)

  const project = ([lon, lat]: [number, number]): [number, number] => [
    lonToX(lon, zoom) * TILE - originX,
    latToY(lat, zoom) * TILE - originY,
  ]

  ctx.beginPath()
  ring.forEach((pt, i) => {
    const [x, y] = project(pt)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = 'rgba(138, 60, 34, 0.22)'
  ctx.fill()
  ctx.strokeStyle = '#E7E3D8'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.fillStyle = '#E7E3D8'
  ring.forEach((pt) => {
    const [x, y] = project(pt)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  try {
    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } catch {
    return null
  }
}

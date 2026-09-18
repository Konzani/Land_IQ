'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import type { Ring } from '../lib/spatial/geometry'
import { formatDMS } from '../lib/spatial/geometry'

type Basemap = 'imagery' | 'terrain'

const BASEMAPS: Record<Basemap, { url: string; attribution: string; label: string; overlay?: string }> = {
  imagery: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    overlay:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  terrain: {
    label: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Map &copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
  },
}

interface Props {
  onParcelDrawn: (ring: Ring) => void
  onCleared: () => void
  busy: boolean
}

export default function MapCanvas({ onParcelDrawn, onCleared, busy }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.FeatureGroup | null>(null)
  const handlerRef = useRef<L.Draw.Polygon | null>(null)
  const baseRef = useRef<{ base: L.TileLayer; overlay?: L.TileLayer } | null>(null)

  const [basemap, setBasemap] = useState<Basemap>('imagery')
  const [drawing, setDrawing] = useState(false)
  const [hasParcel, setHasParcel] = useState(false)
  const [cursor, setCursor] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [-1.2921, 36.8219],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
    })
    mapRef.current = map

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 140 }).addTo(map)

    const drawn = new L.FeatureGroup()
    map.addLayer(drawn)
    drawnRef.current = drawn

    map.on('mousemove', (e: L.LeafletMouseEvent) => setCursor([e.latlng.lat, e.latlng.lng]))
    map.on('mouseout', () => setCursor(null))

    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.Polygon }).layer
      drawn.clearLayers()
      drawn.addLayer(layer)
      layer.setStyle({
        color: '#E7E3D8',
        weight: 2,
        fillColor: '#8A3C22',
        fillOpacity: 0.16,
        dashArray: '1 0',
      })
      map.fitBounds(layer.getBounds(), { padding: [64, 64], maxZoom: 17 })

      const latlngs = layer.getLatLngs()[0] as L.LatLng[]
      setDrawing(false)
      setHasParcel(true)
      onParcelDrawn(latlngs.map((p) => [p.lng, p.lat] as [number, number]))
    })

    map.on(L.Draw.Event.DRAWSTOP, () => setDrawing(false))

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onParcelDrawn])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const spec = BASEMAPS[basemap]

    baseRef.current?.base.remove()
    baseRef.current?.overlay?.remove()

    const base = L.tileLayer(spec.url, { attribution: spec.attribution, maxZoom: 19 }).addTo(map)
    const overlay = spec.overlay
      ? L.tileLayer(spec.overlay, { maxZoom: 19, opacity: 0.85 }).addTo(map)
      : undefined
    base.setZIndex(1)
    overlay?.setZIndex(2)
    baseRef.current = { base, overlay }
  }, [basemap])

  const startDrawing = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    handlerRef.current?.disable()
    const handler = new L.Draw.Polygon(map as L.DrawMap, {
      allowIntersection: false,
      showArea: false,
      shapeOptions: { color: '#E7E3D8', weight: 2, fillColor: '#8A3C22', fillOpacity: 0.12 },
    })
    handlerRef.current = handler
    handler.enable()
    setDrawing(true)
  }, [])

  const clear = useCallback(() => {
    handlerRef.current?.disable()
    drawnRef.current?.clearLayers()
    setDrawing(false)
    setHasParcel(false)
    onCleared()
  }, [onCleared])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawing) {
        handlerRef.current?.disable()
        setDrawing(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawing])

  return (
    <div className="relative h-full w-full bg-canvas">
      <div ref={containerRef} className="absolute inset-0" aria-label="Parcel map" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between p-4">
        <div className="pointer-events-auto rounded-sheet border border-white/10 bg-ink/80 px-3 py-2 backdrop-blur">
          <p className="font-sheet text-[15px] leading-none text-linen-pale">LandIQ</p>
          <p className="label-note mt-1 leading-none text-linen/55">Land suitability assessment</p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-col gap-2">
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={drawing ? () => { handlerRef.current?.disable(); setDrawing(false) } : startDrawing}
            disabled={busy}
            data-active={drawing}
            className="map-control"
          >
            {drawing ? 'Stop drawing' : hasParcel ? 'Redraw boundary' : 'Draw boundary'}
          </button>
          <button type="button" onClick={clear} disabled={busy || (!hasParcel && !drawing)} className="map-control">
            Clear
          </button>
          <button
            type="button"
            onClick={() => setBasemap(basemap === 'imagery' ? 'terrain' : 'imagery')}
            className="map-control"
          >
            {BASEMAPS[basemap === 'imagery' ? 'terrain' : 'imagery'].label}
          </button>
        </div>
        {drawing && (
          <p className="pointer-events-none max-w-xs rounded-sheet bg-ink/80 px-3 py-2 text-micro text-linen/80 backdrop-blur">
            Click to place each corner, then click the first point again to close. Escape cancels.
          </p>
        )}
        {cursor && (
          <p className="pointer-events-none text-micro text-linen/60">
            {formatDMS(cursor[0], 'lat')} &nbsp; {formatDMS(cursor[1], 'lon')}
          </p>
        )}
      </div>
    </div>
  )
}

import { NextResponse } from 'next/server'
import { readCache, writeCache } from '../../../lib/supabase/server'
import type { ClimateMetrics, MonthlyClimate } from '../../../lib/spatial/types'

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const YEARS = 10
const CACHE_MS = 1000 * 60 * 60 * 24 * 30

interface ArchiveResponse {
  daily?: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Supply numeric lat and lon parameters.' }, { status: 400 })
  }

  const gridKey = `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lon * 10) / 10).toFixed(1)}`
  const cached = await readCache<ClimateMetrics>('climate_cache', gridKey, CACHE_MS)
  if (cached) return NextResponse.json(cached)

  const end = new Date()
  end.setDate(end.getDate() - 7)
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - YEARS)

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
  })

  const res = await fetch(`${ARCHIVE}?${params.toString()}`)
  if (!res.ok) {
    return NextResponse.json({ error: `Climate archive returned ${res.status}` }, { status: 502 })
  }

  const json = (await res.json()) as ArchiveResponse
  const daily = json.daily
  if (!daily?.time?.length) {
    return NextResponse.json({ error: 'No climate record for this location.' }, { status: 502 })
  }

  const monthlyRain = Array.from({ length: 12 }, () => [] as number[])
  const monthlyTMax = Array.from({ length: 12 }, () => [] as number[])
  const monthlyTMin = Array.from({ length: 12 }, () => [] as number[])
  const yearlyRain = new Map<number, number>()

  let absMin = Infinity
  let frostDays = 0
  let gdd = 0
  let tMaxSum = 0
  let tMinSum = 0
  let tCount = 0

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i]
    const month = Number(date.slice(5, 7)) - 1
    const year = Number(date.slice(0, 4))
    const tMax = daily.temperature_2m_max[i]
    const tMin = daily.temperature_2m_min[i]
    const rain = daily.precipitation_sum[i]

    if (typeof rain === 'number') {
      monthlyRain[month].push(rain)
      yearlyRain.set(year, (yearlyRain.get(year) ?? 0) + rain)
    }
    if (typeof tMax === 'number' && typeof tMin === 'number') {
      monthlyTMax[month].push(tMax)
      monthlyTMin[month].push(tMin)
      tMaxSum += tMax
      tMinSum += tMin
      tCount++
      absMin = Math.min(absMin, tMin)
      if (tMin <= 0) frostDays++
      gdd += Math.max(0, (tMax + tMin) / 2 - 10)
    }
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
  const completeYears = Array.from(yearlyRain.entries()).filter(([y]) => y !== start.getFullYear() && y !== end.getFullYear())
  const yearsCounted = completeYears.length || 1

  const monthly: MonthlyClimate[] = monthlyRain.map((rains, m) => ({
    month: m + 1,
    rainfallMm: (rains.reduce((a, b) => a + b, 0) / yearsCounted) || 0,
    tMaxC: avg(monthlyTMax[m]),
    tMinC: avg(monthlyTMin[m]),
  }))

  const annualRainfallMm = completeYears.length
    ? completeYears.reduce((a, [, v]) => a + v, 0) / completeYears.length
    : monthly.reduce((a, m) => a + m.rainfallMm, 0)

  const longRainsMm = monthly.slice(2, 5).reduce((a, m) => a + m.rainfallMm, 0)
  const shortRainsMm = monthly.slice(9, 12).reduce((a, m) => a + m.rainfallMm, 0)
  const dryMonths = monthly.filter((m) => m.rainfallMm < 60).length
  const wettestMonth = monthly.reduce((best, m) => (m.rainfallMm > best.rainfallMm ? m : best), monthly[0]).month

  const peaks = monthly.filter(
    (m, i) =>
      m.rainfallMm > monthly[(i + 11) % 12].rainfallMm &&
      m.rainfallMm > monthly[(i + 1) % 12].rainfallMm &&
      m.rainfallMm > annualRainfallMm / 12,
  ).length

  const metrics: ClimateMetrics = {
    annualRainfallMm,
    meanTempC: tCount ? (tMaxSum + tMinSum) / (2 * tCount) : 0,
    meanTMaxC: tCount ? tMaxSum / tCount : 0,
    meanTMinC: tCount ? tMinSum / tCount : 0,
    absMinTempC: Number.isFinite(absMin) ? absMin : 0,
    frostDaysPerYear: frostDays / yearsCounted,
    gddBase10: gdd / yearsCounted,
    dryMonths,
    wettestMonth,
    longRainsMm,
    shortRainsMm,
    rainfallPattern: peaks >= 2 ? 'bimodal' : peaks === 1 ? 'unimodal' : 'aseasonal',
    monthly,
    yearsAnalysed: yearsCounted,
    source: `ERA5 reanalysis via Open-Meteo, ${yearsCounted}-year normals`,
  }

  await writeCache('climate_cache', gridKey, metrics)
  return NextResponse.json(metrics)
}

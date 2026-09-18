'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ring } from '../lib/spatial/geometry'
import type { ParcelAnalysis, WorkerMessage, WorkerStage } from '../lib/spatial/types'
import { rankCrops, type CropAssessment } from '../lib/agronomy/suitability'
import MapCanvas from './MapCanvas'
import EvaluationSheet, { type SheetStatus } from './EvaluationSheet'

export default function Workspace() {
  const workerRef = useRef<Worker | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastRingRef = useRef<Ring | null>(null)

  const [status, setStatus] = useState<SheetStatus>('empty')
  const [stage, setStage] = useState<WorkerStage | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ParcelAnalysis | null>(null)
  const [assessments, setAssessments] = useState<CropAssessment[]>([])
  const [narrative, setNarrative] = useState('')
  const [streaming, setStreaming] = useState(false)

  const streamNarrative = useCallback(async (result: ParcelAnalysis) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setNarrative('')
    setStreaming(true)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '')
        setNarrative(detail || 'The interpretation could not be generated. The measured values above are unaffected.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        setNarrative((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setNarrative('The interpretation could not be generated. The measured values above are unaffected.')
      }
    } finally {
      setStreaming(false)
    }
  }, [])

  useEffect(() => {
    const worker = new Worker(new URL('../lib/spatial/analysis-worker.ts', import.meta.url))
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        setStage(msg.stage)
      } else if (msg.type === 'warning') {
        setWarnings((prev) => (prev.includes(msg.message) ? prev : [...prev, msg.message]))
      } else if (msg.type === 'failed') {
        setError(msg.message)
        setStatus('error')
        setStage(null)
      } else if (msg.type === 'complete') {
        setAnalysis(msg.analysis)
        setAssessments(rankCrops(msg.analysis))
        setStatus('ready')
        setStage(null)
        void streamNarrative(msg.analysis)
      }
    }

    worker.onerror = () => {
      setError('The analysis engine failed to start. Reload the page and try again.')
      setStatus('error')
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      abortRef.current?.abort()
    }
  }, [streamNarrative])

  const run = useCallback((ring: Ring) => {
    lastRingRef.current = ring
    setStatus('working')
    setStage('geometry')
    setWarnings([])
    setError(null)
    setNarrative('')
    setAssessments([])
    setAnalysis(null)
    workerRef.current?.postMessage({ ring })
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    lastRingRef.current = null
    setStatus('empty')
    setStage(null)
    setWarnings([])
    setError(null)
    setAnalysis(null)
    setAssessments([])
    setNarrative('')
  }, [])

  const retry = useCallback(() => {
    if (lastRingRef.current) run(lastRingRef.current)
  }, [run])

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden lg:flex-row">
      <div className="h-[46vh] w-full shrink-0 lg:h-full lg:flex-1">
        <MapCanvas onParcelDrawn={run} onCleared={reset} busy={status === 'working'} />
      </div>
      <div className="min-h-0 flex-1 lg:w-[440px] lg:flex-none">
        <EvaluationSheet
          status={status}
          stage={stage}
          warnings={warnings}
          error={error}
          analysis={analysis}
          assessments={assessments}
          narrative={narrative}
          narrativeStreaming={streaming}
          onRetry={retry}
        />
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import type { ParcelAnalysis, WorkerStage } from '../lib/spatial/types'
import type { CropAssessment } from '../lib/agronomy/suitability'
import { formatDMS } from '../lib/spatial/geometry'
import { buildReport, downloadReport } from '../lib/report/pdf'
import IndicatorTable from './IndicatorTable'
import SuitabilityTable from './SuitabilityTable'
import Narrative from './Narrative'

export type SheetStatus = 'empty' | 'working' | 'ready' | 'error'

const STAGES: { id: WorkerStage; label: string }[] = [
  { id: 'geometry', label: 'Parcel geometry' },
  { id: 'terrain', label: 'Elevation and slope' },
  { id: 'soil', label: 'Soil profile' },
  { id: 'climate', label: 'Climate normals' },
  { id: 'scoring', label: 'Suitability scoring' },
]

interface Props {
  status: SheetStatus
  stage: WorkerStage | null
  warnings: string[]
  error: string | null
  analysis: ParcelAnalysis | null
  assessments: CropAssessment[]
  narrative: string
  narrativeStreaming: boolean
  onRetry: () => void
}

export default function EvaluationSheet({
  status,
  stage,
  warnings,
  error,
  analysis,
  assessments,
  narrative,
  narrativeStreaming,
  onRetry,
}: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    if (!analysis) return
    setExporting(true)
    setExportError(null)
    try {
      const blob = await buildReport({ analysis, assessments, narrative })
      downloadReport(blob, analysis.reference)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The report could not be generated.')
    } finally {
      setExporting(false)
    }
  }

  const activeIndex = stage ? STAGES.findIndex((s) => s.id === stage) : -1

  return (
    <aside className="sheet-surface flex h-full flex-col shadow-sheet">
      {status === 'empty' && (
        <div className="flex flex-1 flex-col justify-end p-7">
          <h2 className="max-w-[22ch] font-sheet text-[26px] leading-[1.15] text-ink">
            Trace a boundary and this sheet fills in.
          </h2>
          <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-soft">
            LandIQ measures soil, terrain and climate for the exact area you draw, scores sixteen crops against
            published requirement ranges, and writes up what the numbers mean.
          </p>
          <ol className="mt-7 space-y-3">
            {['Draw the parcel on the map', 'Indicators are sampled and scored', 'Download the assessment'].map(
              (step, i) => (
                <li key={step} className="flex gap-3 text-sm text-ink-soft">
                  <span className="mt-[2px] text-micro text-ink-faint">{i + 1}</span>
                  {step}
                </li>
              ),
            )}
          </ol>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 flex-col justify-center gap-4 p-7">
          <h2 className="font-sheet text-xl text-ink">The assessment stopped</h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded-sheet bg-nitisol px-4 py-2 text-sm text-linen-pale transition-colors hover:bg-nitisol-deep"
          >
            Run it again
          </button>
        </div>
      )}

      {(status === 'working' || status === 'ready') && analysis && (
        <>
          <header className="border-b border-rule px-7 pb-5 pt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sheet text-[52px] leading-[0.9] text-ink">{analysis.parcel.areaHa.toFixed(2)}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  hectares · {analysis.parcel.areaAcres.toFixed(2)} acres
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink">{analysis.reference}</p>
                <p className="label-note mt-1">
                  {new Date(analysis.generatedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                </p>
              </div>
            </div>
            <p className="label-note mt-4">
              {formatDMS(analysis.parcel.centroid[1], 'lat')} &nbsp; {formatDMS(analysis.parcel.centroid[0], 'lon')}
              &nbsp;·&nbsp; {Math.round(analysis.parcel.perimeterM)} m perimeter
            </p>
          </header>

          <div className="flex-1 space-y-8 overflow-y-auto px-7 py-6">
            {status === 'working' && (
              <ol className="space-y-2">
                {STAGES.map((s, i) => {
                  const state = activeIndex > i ? 'done' : activeIndex === i ? 'active' : 'pending'
                  return (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          state === 'done' ? 'bg-field' : state === 'active' ? 'animate-pulse bg-nitisol' : 'bg-rule'
                        }`}
                        aria-hidden
                      />
                      <span className={state === 'pending' ? 'text-ink-faint' : 'text-ink-soft'}>{s.label}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            {warnings.length > 0 && (
              <div className="border-l-2 border-ochre pl-3">
                <p className="text-sm text-ink">Partial data</p>
                {warnings.map((w) => (
                  <p key={w} className="label-note mt-1">
                    {w}
                  </p>
                ))}
              </div>
            )}

            <IndicatorTable analysis={analysis} />

            {assessments.length > 0 && <SuitabilityTable assessments={assessments} />}

            {(narrative || narrativeStreaming) && <Narrative text={narrative} streaming={narrativeStreaming} />}
          </div>

          <footer className="border-t border-rule px-7 py-4">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || status !== 'ready'}
              className="w-full rounded-sheet bg-nitisol px-4 py-3 text-sm text-linen-pale transition-colors hover:bg-nitisol-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Building the report…' : 'Download assessment'}
            </button>
            {exportError && <p className="label-note mt-2 text-nitisol">{exportError}</p>}
          </footer>
        </>
      )}
    </aside>
  )
}

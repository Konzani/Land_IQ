import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { ParcelAnalysis } from '../spatial/types'
import type { CropAssessment, SuitabilityClass } from '../agronomy/suitability'
import { buildIndicatorGroups } from '../../components/IndicatorTable'
import { renderParcelImage } from './map-image'
import { formatDMS } from '../spatial/geometry'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const CONTENT = A4[0] - MARGIN * 2

const INK = rgb(0.098, 0.09, 0.071)
const SOFT = rgb(0.29, 0.271, 0.231)
const FAINT = rgb(0.482, 0.455, 0.4)
const RULE = rgb(0.769, 0.745, 0.682)
const NITISOL = rgb(0.541, 0.235, 0.133)

const CLASS_RGB: Record<SuitabilityClass, RGB> = {
  S1: rgb(0.306, 0.4, 0.212),
  S2: rgb(0.486, 0.541, 0.243),
  S3: rgb(0.69, 0.478, 0.18),
  N: rgb(0.541, 0.235, 0.133),
}

const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201B]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/[\u2013\u2014]/g, '-'],
  [/\u2026/g, '...'],
  [/\u00b0/g, ' deg'],
  [/[\u2022\u00b7]/g, '-'],
  [/\u00a0/g, ' '],
  [/\u2212/g, '-'],
]

function safe(text: string): string {
  let out = text
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement)
  return out.replace(/[^\x20-\x7E\n]/g, '')
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of safe(text).split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

class Sheet {
  private page: PDFPage
  private y: number
  readonly pages: PDFPage[] = []

  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = this.newPage()
    this.y = A4[1] - MARGIN
  }

  private newPage(): PDFPage {
    const page = this.doc.addPage(A4)
    this.pages.push(page)
    return page
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 34) {
      this.page = this.newPage()
      this.y = A4[1] - MARGIN
    }
  }

  get cursor() {
    return this.y
  }

  get current() {
    return this.page
  }

  gap(height: number) {
    this.y -= height
  }

  rule(color = RULE) {
    this.ensure(10)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT, y: this.y },
      thickness: 0.6,
      color,
    })
    this.y -= 14
  }

  text(
    content: string,
    opts: { size?: number; bold?: boolean; color?: RGB; leading?: number; indent?: number; width?: number } = {},
  ) {
    const size = opts.size ?? 9.5
    const font = opts.bold ? this.bold : this.regular
    const leading = opts.leading ?? size * 1.5
    const indent = opts.indent ?? 0
    for (const line of wrap(content, font, size, (opts.width ?? CONTENT) - indent)) {
      this.ensure(leading)
      if (line) {
        this.page.drawText(line, {
          x: MARGIN + indent,
          y: this.y - size,
          size,
          font,
          color: opts.color ?? SOFT,
        })
      }
      this.y -= leading
    }
  }

  heading(content: string) {
    this.ensure(34)
    this.gap(8)
    this.text(content, { size: 13, bold: true, color: INK, leading: 18 })
    this.gap(2)
  }

  row(label: string, value: string, opts: { color?: RGB } = {}) {
    const size = 9.5
    this.ensure(17)
    this.page.drawText(safe(label), { x: MARGIN, y: this.y - size, size, font: this.regular, color: SOFT })
    const text = safe(value)
    const width = this.regular.widthOfTextAtSize(text, size)
    this.page.drawText(text, {
      x: MARGIN + CONTENT - width,
      y: this.y - size,
      size,
      font: this.regular,
      color: opts.color ?? INK,
    })
    this.y -= 13
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 3 },
      end: { x: MARGIN + CONTENT, y: this.y + 3 },
      thickness: 0.4,
      color: RULE,
    })
    this.y -= 4
  }

  scoreRow(index: number, assessment: CropAssessment) {
    const size = 9.5
    this.ensure(20)
    const baseline = this.y - size
    this.page.drawText(`${index}`, { x: MARGIN, y: baseline, size: 8, font: this.regular, color: FAINT })
    this.page.drawText(safe(assessment.crop.name), {
      x: MARGIN + 18,
      y: baseline,
      size,
      font: this.regular,
      color: INK,
    })

    const barX = MARGIN + CONTENT - 150
    this.page.drawRectangle({ x: barX, y: baseline, width: 90, height: 4, color: RULE })
    this.page.drawRectangle({
      x: barX,
      y: baseline,
      width: (90 * assessment.score) / 100,
      height: 4,
      color: CLASS_RGB[assessment.class],
    })

    const scoreText = String(assessment.score)
    this.page.drawText(scoreText, {
      x: MARGIN + CONTENT - 48 - this.regular.widthOfTextAtSize(scoreText, size),
      y: baseline,
      size,
      font: this.regular,
      color: INK,
    })
    this.page.drawText(assessment.class, {
      x: MARGIN + CONTENT - 24,
      y: baseline,
      size,
      font: this.bold,
      color: CLASS_RGB[assessment.class],
    })

    this.y -= 14
    const limits = assessment.limiting.length
      ? `Limited by ${assessment.limiting.map((f) => f.factor.toLowerCase()).join(', ')}`
      : 'No limiting factor identified'
    this.text(limits, { size: 7.5, color: FAINT, indent: 18, leading: 10 })
    this.gap(3)
  }

  image(png: { dataUrl: string; width: number; height: number }, embedded: { width: number; height: number }) {
    const scale = CONTENT / embedded.width
    const height = embedded.height * scale
    this.ensure(height + 10)
    return { x: MARGIN, y: this.y - height, width: CONTENT, height, consume: () => (this.y -= height + 10) }
  }
}

export interface ReportInput {
  analysis: ParcelAnalysis
  assessments: CropAssessment[]
  narrative: string
}

export async function buildReport({ analysis, assessments, narrative }: ReportInput): Promise<Blob> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const sheet = new Sheet(doc, regular, bold)
  const { parcel } = analysis
  const [lon, lat] = parcel.centroid

  sheet.text('Land suitability assessment', { size: 19, bold: true, color: INK, leading: 26 })
  sheet.text(`Parcel ${analysis.reference}`, { size: 9.5, color: FAINT, leading: 16 })
  sheet.gap(6)
  sheet.rule(NITISOL)

  sheet.row('Area', `${parcel.areaHa.toFixed(2)} ha  /  ${parcel.areaAcres.toFixed(2)} acres`)
  sheet.row('Perimeter', `${Math.round(parcel.perimeterM)} m`)
  sheet.row('Centroid', `${formatDMS(lat, 'lat')}  ${formatDMS(lon, 'lon')}`)
  sheet.row('Boundary points', String(parcel.ring.length))
  sheet.row('Assessed', new Date(analysis.generatedAt).toLocaleDateString('en-GB', { dateStyle: 'long' }))

  const image = await renderParcelImage(parcel.ring, 1000, 620)
  if (image) {
    try {
      const png = await doc.embedPng(image.dataUrl)
      sheet.gap(10)
      const slot = sheet.image(image, png)
      slot.consume()
      sheet.current.drawImage(png, { x: slot.x, y: slot.y, width: slot.width, height: slot.height })
      sheet.text('Parcel boundary over Esri World Imagery.', { size: 7.5, color: FAINT, leading: 11 })
    } catch {
      // Imagery is optional; the report stands without it.
    }
  }

  sheet.heading('Measured indicators')
  for (const group of buildIndicatorGroups(analysis)) {
    sheet.text(group.title, { size: 10, bold: true, color: INK, leading: 16 })
    for (const row of group.rows) sheet.row(row.label, row.value)
    sheet.text(group.source, { size: 7.5, color: FAINT, leading: 12 })
    sheet.gap(6)
  }

  sheet.heading('Crop suitability ranking')
  sheet.text('S1 highly suitable, S2 moderately suitable, S3 marginally suitable, N not suitable.', {
    size: 8,
    color: FAINT,
    leading: 13,
  })
  sheet.gap(4)
  assessments.slice(0, 10).forEach((a, i) => sheet.scoreRow(i + 1, a))

  const leader = assessments[0]
  if (leader?.interventions.length) {
    sheet.heading(`Preparing for ${leader.crop.name.toLowerCase()}`)
    for (const tip of leader.interventions) sheet.text(`- ${tip}`, { size: 9.5, leading: 14 })
  }

  if (narrative.trim()) {
    sheet.heading('Interpretation')
    for (const line of narrative.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) {
        sheet.gap(5)
        continue
      }
      if (trimmed.startsWith('#')) {
        sheet.text(trimmed.replace(/^#+\s*/, ''), { size: 10.5, bold: true, color: INK, leading: 16 })
      } else if (/^[-*]\s+/.test(trimmed)) {
        sheet.text(`- ${trimmed.replace(/^[-*]\s+/, '').replace(/\*\*/g, '')}`, { size: 9.5, leading: 14, indent: 10 })
      } else {
        sheet.text(trimmed.replace(/\*\*/g, ''), { size: 9.5, leading: 14 })
      }
    }
  }

  sheet.heading('Basis and limitations')
  sheet.text(
    'Suitability scores come from a deterministic model that compares measured site values against published crop requirement ranges, using a limiting-factor weighting. Soil values are modelled global estimates at roughly 250 m resolution and are not a substitute for a laboratory test of samples taken on site. Climate figures are reanalysis normals and describe the recent past, not a forecast. Confirm effective rooting depth, stoniness and water rights before committing capital.',
    { size: 8.5, color: SOFT, leading: 13 },
  )

  const total = sheet.pages.length
  sheet.pages.forEach((page, i) => {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN - 14 },
      end: { x: MARGIN + CONTENT, y: MARGIN - 14 },
      thickness: 0.4,
      color: RULE,
    })
    page.drawText(safe(`LandIQ  ${analysis.reference}`), {
      x: MARGIN,
      y: MARGIN - 26,
      size: 7.5,
      font: regular,
      color: FAINT,
    })
    const label = `${i + 1} of ${total}`
    page.drawText(label, {
      x: MARGIN + CONTENT - regular.widthOfTextAtSize(label, 7.5),
      y: MARGIN - 26,
      size: 7.5,
      font: regular,
      color: FAINT,
    })
  })

  const bytes = await doc.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

export function downloadReport(blob: Blob, reference: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `LandIQ-${reference}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

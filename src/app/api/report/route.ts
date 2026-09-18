import OpenAI from 'openai'
import { getSupabaseAdmin } from '../../../lib/supabase/server'
import { buildUserPrompt, SYSTEM_PROMPT } from '../../../lib/ai/prompt'
import { rankCrops } from '../../../lib/agronomy/suitability'
import type { ParcelAnalysis } from '../../../lib/spatial/types'

export const runtime = 'edge'

const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'

async function withinRateLimit(req: Request): Promise<boolean> {
  const db = getSupabaseAdmin()
  if (!db) return true
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { data, error } = await db.rpc('check_rate_limit', { user_ip: ip })
  if (error) {
    console.warn('Rate limit check unavailable, allowing request:', error.message)
    return true
  }
  return data !== false
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return new Response('The reporting service is not configured. Set DEEPSEEK_API_KEY.', { status: 503 })
  }

  if (!(await withinRateLimit(req))) {
    return new Response('You have reached the hourly report limit. Try again later.', { status: 429 })
  }

  let analysis: ParcelAnalysis
  try {
    analysis = (await req.json()) as ParcelAnalysis
  } catch {
    return new Response('Send the parcel analysis as a JSON body.', { status: 400 })
  }

  if (!analysis?.parcel?.ring?.length) {
    return new Response('The analysis payload is missing parcel geometry.', { status: 400 })
  }

  const client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })

  let stream: Awaited<ReturnType<typeof client.chat.completions.create>>
  try {
    stream = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1600,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(analysis, rankCrops(analysis)) },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`The reporting model rejected the request: ${message}`, { status: 502 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream as AsyncIterable<{
          choices: { delta?: { content?: string | null } }[]
        }>) {
          const text = chunk.choices?.[0]?.delta?.content
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch {
        controller.enqueue(encoder.encode('\n\nThe report stream was interrupted before it finished.'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

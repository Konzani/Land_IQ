import { supabaseAdmin } from '../../../lib/supabase/server';
import { getLocalClimate } from '../../../lib/climate/open-meteo';
import { getAgronomistPrompt } from '../../../lib/ai/prompt-templates';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: Request) {
  const userIP = req.headers.get("x-forwarded-for") || "unknown";

  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', { user_ip: userIP });

  if (error || !data) {
    return new Response("Rate limit exceeded.", { status: 429 });
  }

  const payload = await req.json();
  const climate = await getLocalClimate(payload.lat, payload.lon);
  
  const metrics = {
    ...payload.stats,
    temperature: climate.temperature,
    rainfall: climate.rainfall
  };

  const systemPrompt = getAgronomistPrompt(metrics);

  const response = await openai.chat.completions.create({
    model: "deepseek-flash",
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 1.0,
    stream: true,
  });

  return new Response(response.toReadableStream());
}
import { supabaseAdmin } from '../supabase/server';

export async function getLocalClimate(lat: number, lon: number) {
  const gridLat = (Math.round(lat * 20) / 20).toFixed(2);
  const gridLon = (Math.round(lon * 20) / 20).toFixed(2);
  const gridId = `${gridLat},${gridLon}`;

  const { data: cache } = await supabaseAdmin
    .from('weather_cache')
    .select('*')
    .eq('grid_id', gridId)
    .single();

  if (cache && (Date.now() - new Date(cache.cached_at).getTime() < 10800000)) {
    return { temperature: cache.temperature, rainfall: cache.rainfall };
  }

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${gridLat}&longitude=${gridLon}&current=temperature_2m,precipitation`);
  const data = await response.json();

  const temperature = data.current.temperature_2m;
  const rainfall = data.current.precipitation;

  await supabaseAdmin
    .from('weather_cache')
    .upsert({ grid_id: gridId, temperature, rainfall, cached_at: new Date().toISOString() });

  return { temperature, rainfall };
}
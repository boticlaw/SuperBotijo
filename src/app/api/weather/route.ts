/**
 * Weather API - Madrid
 * GET /api/weather
 * Uses Open-Meteo (free, no API key)
 */
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

// Cache weather data for 10 minutes
let cache: { data: unknown; ts: number } | null = null;
const CACHE_DURATION = 10 * 60 * 1000;

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Foggy", emoji: "🌫️" },
  48: { label: "Icy fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Heavy drizzle", emoji: "🌧️" },
  61: { label: "Light rain", emoji: "🌧️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  71: { label: "Light snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "❄️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Light showers", emoji: "🌦️" },
  81: { label: "Showers", emoji: "🌧️" },
  82: { label: "Heavy showers", emoji: "⛈️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm with hail", emoji: "⛈️" },
  99: { label: "Thunderstorm with heavy hail", emoji: "⛈️" },
};

export async function GET() {
  // Return cache if valid
  if (cache && Date.now() - cache.ts < CACHE_DURATION) {
    return NextResponse.json(cache.data);
  }

  const lat = process.env.WEATHER_LAT ?? '40.4168';
  const lon = process.env.WEATHER_LON ?? '-3.7038';
  const city = process.env.WEATHER_CITY ?? 'Madrid';
  const timezone = process.env.WEATHER_TIMEZONE ?? 'Europe/Madrid';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=${encodeURIComponent(timezone)}&forecast_days=3`;

    const res = await fetch(url, { next: { revalidate: 600 } });
    const json = await res.json();

    const current = json.current;
    const daily = json.daily;

    const wmo = WMO_CODES[current.weather_code] || { label: "Unknown", emoji: "🌡️" };

    const data = {
      city,
      temp: Math.round(current.temperature_2m),
      feels_like: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      wind: Math.round(current.wind_speed_10m),
      precipitation: current.precipitation,
      condition: wmo.label,
      emoji: wmo.emoji,
      forecast: daily.time.slice(0, 3).map((day: string, i: number) => ({
        day,
        max: Math.round(daily.temperature_2m_max[i]),
        min: Math.round(daily.temperature_2m_min[i]),
        emoji: (WMO_CODES[daily.weather_code[i]] || { emoji: "🌡️" }).emoji,
      })),
      updated: new Date().toISOString(),
    };

    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error('[weather] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}

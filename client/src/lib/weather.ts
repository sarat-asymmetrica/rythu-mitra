/**
 * Weather service for Rythu Mitra.
 * Uses Open-Meteo (FREE, no API key needed!).
 *
 * Default location: Anantapur, AP (14.68°N, 77.60°E)
 * Caches in localStorage with 1-hour freshness.
 */

export interface WeatherCurrent {
  temperature: number;   // °C
  humidity: number;      // %
  windSpeed: number;     // km/h
  weatherCode: number;   // WMO code
  description: string;   // Telugu description
  icon: string;          // emoji
}

export interface WeatherDay {
  date: string;          // "2026-03-17"
  dayLabel: string;      // "సోమ" (Mon in Telugu)
  tempMax: number;       // °C
  tempMin: number;
  rain: number;          // mm
  wind: number;          // km/h max
  icon: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherDay[];  // 7 days
  fetchedAt: string;       // ISO timestamp
  location: string;        // "అనంతపురం"
}

// District coordinates (AP/Telangana)
export const DISTRICT_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  'అనంతపురం': { lat: 14.68, lon: 77.60, name: 'అనంతపురం' },
  'కర్నూలు':  { lat: 15.83, lon: 78.05, name: 'కర్నూలు' },
  'గుంటూరు':  { lat: 16.31, lon: 80.44, name: 'గుంటూరు' },
  'విశాఖపట్నం': { lat: 17.69, lon: 83.22, name: 'విశాఖపట్నం' },
  'హైదరాబాద్': { lat: 17.39, lon: 78.49, name: 'హైదరాబాద్' },
  'default':   { lat: 14.68, lon: 77.60, name: 'అనంతపురం' },
};

// WMO weather codes → Telugu description + emoji
const WEATHER_CODES: Record<number, { te: string; icon: string }> = {
  0:  { te: 'నిర్మలమైన ఆకాశం',           icon: '☀️' },
  1:  { te: 'కొద్దిగా మేఘావృతం',          icon: '🌤️' },
  2:  { te: 'పాక్షిక మేఘావృతం',           icon: '⛅' },
  3:  { te: 'మేఘావృతం',                   icon: '☁️' },
  45: { te: 'పొగ',                         icon: '🌫️' },
  48: { te: 'మంచు',                        icon: '🌫️' },
  51: { te: 'తేలికపాటి జల్లు',             icon: '🌦️' },
  53: { te: 'మధ్యస్థ జల్లు',              icon: '🌧️' },
  55: { te: 'భారీ జల్లు',                 icon: '🌧️' },
  61: { te: 'తేలికపాటి వర్షం',             icon: '🌧️' },
  63: { te: 'మధ్యస్థ వర్షం',              icon: '🌧️' },
  65: { te: 'భారీ వర్షం',                 icon: '⛈️' },
  80: { te: 'తేలికపాటి జల్లులు',           icon: '🌦️' },
  81: { te: 'మధ్యస్థ జల్లులు',             icon: '🌧️' },
  82: { te: 'భారీ జల్లులు',               icon: '⛈️' },
  95: { te: 'ఉరుములు-మెరుపులతో వర్షం',    icon: '⛈️' },
};

// Telugu day names (Sunday=0)
const TELUGU_DAYS = ['ఆది', 'సోమ', 'మంగళ', 'బుధ', 'గురు', 'శుక్ర', 'శని'];

function getWeatherInfo(code: number): { te: string; icon: string } {
  return (
    WEATHER_CODES[code] ??
    WEATHER_CODES[Math.floor(code / 10) * 10] ??
    { te: 'వాతావరణం', icon: '🌡️' }
  );
}

const CACHE_KEY = 'rythu_mitra_weather_cache';

export function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: WeatherData = JSON.parse(raw);
    // Stale after 1 hour
    const age = Date.now() - new Date(data.fetchedAt).getTime();
    if (age > 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchWeather(district?: string): Promise<WeatherData> {
  const coords = DISTRICT_COORDS[district ?? ''] ?? DISTRICT_COORDS['default'];

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max',
  );
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  );
  url.searchParams.set('timezone', 'Asia/Kolkata');
  url.searchParams.set('forecast_days', '7');

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);

  const json = await response.json();

  const weatherInfo = getWeatherInfo(json.current.weather_code);

  const current: WeatherCurrent = {
    temperature: Math.round(json.current.temperature_2m),
    humidity:    Math.round(json.current.relative_humidity_2m),
    windSpeed:   Math.round(json.current.wind_speed_10m),
    weatherCode: json.current.weather_code,
    description: weatherInfo.te,
    icon:        weatherInfo.icon,
  };

  const forecast: WeatherDay[] = json.daily.time.map((date: string, i: number) => {
    const d = new Date(date + 'T12:00:00');
    const rain =
      (json.daily.precipitation_sum[i] as number) ||
      (json.daily.rain_sum[i] as number) ||
      0;
    const tempMax: number = json.daily.temperature_2m_max[i];
    return {
      date,
      dayLabel:  TELUGU_DAYS[d.getDay()],
      tempMax:   Math.round(tempMax),
      tempMin:   Math.round(json.daily.temperature_2m_min[i]),
      rain:      Math.round(rain * 10) / 10,
      wind:      Math.round(json.daily.wind_speed_10m_max[i]),
      icon:
        rain > 5   ? '🌧️' :
        rain > 0   ? '🌦️' :
        tempMax > 38 ? '🔥' : '☀️',
    };
  });

  const data: WeatherData = {
    current,
    forecast,
    fetchedAt: new Date().toISOString(),
    location:  coords.name,
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return data;
}

// --- Farming Advice Based on Weather ---

export interface FarmingAdvice {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

export function getFarmingAdvice(data: WeatherData): FarmingAdvice[] {
  const advice: FarmingAdvice[] = [];
  const today    = data.forecast[0];
  const tomorrow = data.forecast[1];

  // Heat advisory
  if (today && today.tempMax >= 40) {
    advice.push({
      icon: '🔥',
      text: 'తీవ్ర ఎండ — పగటి పూట పురుగు మందు పిచికారీ చేయకండి',
      severity: 'danger',
    });
  } else if (today && today.tempMax >= 38) {
    advice.push({
      icon: '☀️',
      text: 'ఎండ ఎక్కువ — సాయంత్రం 4 తర్వాత పనులు చేయండి',
      severity: 'warning',
    });
  }

  // Rain in next 3 days
  const rainNext3 = data.forecast.slice(0, 3).reduce((sum, d) => sum + d.rain, 0);
  if (rainNext3 > 20) {
    advice.push({
      icon: '🌧️',
      text: `3 రోజుల్లో ${Math.round(rainNext3)}mm వర్షం — కోత/ఎండబెట్టడం వాయిదా వేయండి`,
      severity: 'warning',
    });
  } else if (tomorrow && tomorrow.rain > 5) {
    advice.push({
      icon: '🌦️',
      text: `రేపు ${tomorrow.rain}mm వర్షం — పిచికారీ నేడే పూర్తి చేయండి`,
      severity: 'info',
    });
  }

  // No rain + hot = irrigate
  const noRain3 = data.forecast.slice(0, 3).every(d => d.rain < 1);
  if (noRain3 && today && today.tempMax > 35) {
    advice.push({
      icon: '💧',
      text: 'వర్షం లేదు, ఎండ ఎక్కువ — నీటిపారుదల చేయండి',
      severity: 'info',
    });
  }

  // Strong wind
  if (today && today.wind > 30) {
    advice.push({
      icon: '💨',
      text: `గాలి ${today.wind} km/h — పిచికారీ వాయిదా వేయండి (మందు వృధా)`,
      severity: 'warning',
    });
  }

  return advice;
}

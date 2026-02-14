/**
 * Free Weather Data Service
 * 
 * Fetches solar irradiance data from Open-Meteo Historical Weather API
 * when no project-specific weather file is uploaded.
 * 
 * Data source: Open-Meteo (https://open-meteo.com)
 * License: Free to use with attribution
 * Coverage: Global, 1940-present (5-day delay)
 */

interface MonthlyIrradianceData {
  month: number;
  monthName: string;
  ghi_kwh_m2: number;
  dni_kwh_m2: number;
  dhi_kwh_m2: number;
  avg_temp_c: number;
}

interface WeatherDataResult {
  source: 'free' | 'uploaded';
  monthlyData: MonthlyIrradianceData[];
  annualGHI: number;
  annualDNI: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Fetch historical solar radiation data from Open-Meteo API
 * 
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param year - Year for data (defaults to 2023, most recent complete year)
 * @returns Monthly irradiance data
 */
export async function fetchFreeWeatherData(
  latitude: number,
  longitude: number,
  year: number = 2023
): Promise<WeatherDataResult> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('hourly', 'shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m');
  url.searchParams.set('timezone', 'auto');

  console.log('[FreeWeather] Fetching data from Open-Meteo:', url.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Process hourly data into monthly aggregates
  const monthlyData: MonthlyIrradianceData[] = [];
  const monthlyTotals = Array(12).fill(0).map(() => ({
    ghi_wh: 0,
    dni_wh: 0,
    dhi_wh: 0,
    temp_sum: 0,
    temp_count: 0,
  }));

  // Sum hourly values for each month
  for (let i = 0; i < data.hourly.time.length; i++) {
    const timestamp = data.hourly.time[i];
    const month = new Date(timestamp).getMonth(); // 0-11

    const ghi = data.hourly.shortwave_radiation[i] || 0;
    const dni = data.hourly.direct_normal_irradiance[i] || 0;
    const dhi = data.hourly.diffuse_radiation[i] || 0;
    const temp = data.hourly.temperature_2m[i];

    monthlyTotals[month].ghi_wh += ghi;
    monthlyTotals[month].dni_wh += dni;
    monthlyTotals[month].dhi_wh += dhi;

    if (temp !== null && temp !== undefined) {
      monthlyTotals[month].temp_sum += temp;
      monthlyTotals[month].temp_count += 1;
    }
  }

  // Convert W·h to kWh/m² and calculate averages
  let annualGHI = 0;
  let annualDNI = 0;

  for (let month = 0; month < 12; month++) {
    const totals = monthlyTotals[month];
    const ghi_kwh_m2 = totals.ghi_wh / 1000;
    const dni_kwh_m2 = totals.dni_wh / 1000;
    const dhi_kwh_m2 = totals.dhi_wh / 1000;
    const avg_temp_c = totals.temp_count > 0 
      ? totals.temp_sum / totals.temp_count 
      : 0;

    monthlyData.push({
      month: month + 1,
      monthName: MONTH_NAMES[month],
      ghi_kwh_m2: Math.round(ghi_kwh_m2 * 10) / 10,
      dni_kwh_m2: Math.round(dni_kwh_m2 * 10) / 10,
      dhi_kwh_m2: Math.round(dhi_kwh_m2 * 10) / 10,
      avg_temp_c: Math.round(avg_temp_c * 10) / 10,
    });

    annualGHI += ghi_kwh_m2;
    annualDNI += dni_kwh_m2;
  }

  console.log('[FreeWeather] Processed monthly data:', {
    annualGHI: Math.round(annualGHI),
    annualDNI: Math.round(annualDNI),
    months: monthlyData.length,
  });

  return {
    source: 'free',
    monthlyData,
    annualGHI: Math.round(annualGHI),
    annualDNI: Math.round(annualDNI),
    location: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  };
}

/**
 * Get weather data for a project, using uploaded file if available,
 * otherwise falling back to free API data based on project location.
 * 
 * @param projectDbName - Project database name
 * @param latitude - Project latitude (required for fallback)
 * @param longitude - Project longitude (required for fallback)
 * @returns Weather data with source indicator
 */
export async function getProjectWeatherData(
  projectDbName: string,
  latitude?: number,
  longitude?: number
): Promise<WeatherDataResult | null> {
  // TODO: Check if uploaded weather file exists in weather_files table
  // If exists and has monthly_irradiance data, return it with source='uploaded'
  
  // For now, fall back to free data if location is available
  if (latitude !== undefined && longitude !== undefined) {
    try {
      return await fetchFreeWeatherData(latitude, longitude);
    } catch (error) {
      console.error('[FreeWeather] Failed to fetch free weather data:', error);
      return null;
    }
  }

  return null;
}

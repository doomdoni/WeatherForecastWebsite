const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

function toKmaGrid(latitude, longitude) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const deg = Math.PI / 180, re = RE / GRID, slat1 = SLAT1 * deg, slat2 = SLAT2 * deg, olon = OLON * deg, olat = OLAT * deg;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(Math.tan(Math.PI * .25 + slat2 * .5) / Math.tan(Math.PI * .25 + slat1 * .5));
  const sf = Math.pow(Math.tan(Math.PI * .25 + slat1 * .5), sn) * Math.cos(slat1) / sn;
  const ro = re * sf / Math.pow(Math.tan(Math.PI * .25 + olat * .5), sn);
  const ra = re * sf / Math.pow(Math.tan(Math.PI * .25 + latitude * deg * .5), sn);
  let theta = longitude * deg - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + .5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + .5) };
}

function baseDateTime() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  now.setHours(now.getHours() - 1);
  const hours = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = [...hours].reverse().find((value) => value <= now.getHours());
  if (hour === undefined) { hour = 23; now.setDate(now.getDate() - 1); }
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return { date, time: `${String(hour).padStart(2, "0")}00` };
}

function wmoCode(sky, precipitation) {
  const pty = Number(precipitation || 0);
  if (pty === 1 || pty === 4) return 61;
  if (pty === 2 || pty === 3) return 71;
  return Number(sky) === 1 ? 0 : Number(sky) === 3 ? 2 : 3;
}

function koreanNow() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { date: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`, time: `${String(now.getHours()).padStart(2, "0")}00` };
}

exports.handler = async (event) => {
  if (!process.env.KMA_SERVICE_KEY) return { statusCode: 500, body: JSON.stringify({ message: "Netlify 환경 변수 KMA_SERVICE_KEY가 설정되지 않았습니다." }) };
  const latitude = Number(event.queryStringParameters?.lat), longitude = Number(event.queryStringParameters?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { statusCode: 400, body: JSON.stringify({ message: "위도와 경도가 필요합니다." }) };
  if (latitude < 32 || latitude > 39.7 || longitude < 124 || longitude > 132) return { statusCode: 400, body: JSON.stringify({ message: "기상청 단기예보는 대한민국 내 위치만 지원합니다." }) };
  try {
    const { nx, ny } = toKmaGrid(latitude, longitude), base = baseDateTime();
    const params = new URLSearchParams({ serviceKey: process.env.KMA_SERVICE_KEY, pageNo: "1", numOfRows: "1000", dataType: "JSON", base_date: base.date, base_time: base.time, nx: String(nx), ny: String(ny) });
    const response = await fetch(`${KMA_BASE}?${params}`);
    const json = await response.json();
    const items = json?.response?.body?.items?.item;
    if (!response.ok || !Array.isArray(items)) throw new Error(json?.response?.header?.resultMsg || "기상청 응답을 읽을 수 없습니다.");
    const grouped = new Map();
    for (const item of items) { const key = `${item.fcstDate}-${item.fcstTime}`; grouped.set(key, { ...(grouped.get(key) || {}), [item.category]: item.fcstValue, date: item.fcstDate, time: item.fcstTime }); }
    const entries = [...grouped.values()].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const currentTarget = koreanNow();
    const current = entries.find((entry) => entry.date === currentTarget.date && entry.time >= currentTarget.time) || entries[0];
    const hourly = entries.slice(0, 24).map((entry) => ({ time: `${entry.date.slice(0, 4)}-${entry.date.slice(4, 6)}-${entry.date.slice(6)}T${entry.time.slice(0, 2)}:00`, temperature_2m: Number(entry.TMP), weather_code: wmoCode(entry.SKY, entry.PTY) }));
    const days = [...new Set(entries.map((entry) => entry.date))].map((date) => {
      const values = entries.filter((entry) => entry.date === date && entry.TMP !== undefined);
      return { date, temperature_2m_max: Math.max(...values.map((entry) => Number(entry.TMP))), temperature_2m_min: Math.min(...values.map((entry) => Number(entry.TMP))), weather_code: wmoCode(values[Math.min(4, values.length - 1)]?.SKY, values[Math.min(4, values.length - 1)]?.PTY) };
    }).slice(0, 3);
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" }, body: JSON.stringify({ timezone: "Asia/Seoul", current: { temperature_2m: Number(current.TMP), relative_humidity_2m: Number(current.REH), apparent_temperature: Number(current.TMP), weather_code: wmoCode(current.SKY, current.PTY), wind_speed_10m: Number(current.WSD) * 3.6, uv_index: null }, hourly: { time: hourly.map((entry) => entry.time), temperature_2m: hourly.map((entry) => entry.temperature_2m), weather_code: hourly.map((entry) => entry.weather_code) }, daily: { time: days.map((entry) => `${entry.date.slice(0, 4)}-${entry.date.slice(4, 6)}-${entry.date.slice(6)}`), temperature_2m_max: days.map((entry) => entry.temperature_2m_max), temperature_2m_min: days.map((entry) => entry.temperature_2m_min), weather_code: days.map((entry) => entry.weather_code) }, air: null, source: "기상청 단기예보" }) };
  } catch (error) { return { statusCode: 502, body: JSON.stringify({ message: error.message || "기상청 API 호출에 실패했습니다." }) }; }
};

const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";
const AIRKOREA_BASE = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

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

function provinceFor(latitude, longitude) {
  if (latitude >= 37.43 && latitude <= 37.72 && longitude >= 126.75 && longitude <= 127.2) return "서울";
  if (latitude >= 37.3 && latitude <= 37.75 && longitude >= 126.3 && longitude < 126.75) return "인천";
  if (latitude >= 37.0 && latitude <= 38.5 && longitude >= 126.4 && longitude <= 127.9) return "경기";
  if (latitude >= 37.8 && longitude >= 127.2) return "강원";
  if (latitude >= 35.8 && latitude <= 37.4 && longitude >= 127.4 && longitude <= 129.5) return "충북";
  if (latitude >= 35.4 && latitude <= 36.8 && longitude >= 126.0 && longitude <= 127.6) return "충남";
  if (latitude >= 35.5 && latitude <= 36.2 && longitude >= 127.0 && longitude <= 127.8) return "대전";
  if (latitude >= 35.0 && latitude <= 36.0 && longitude >= 126.3 && longitude <= 128.0) return "전북";
  if (latitude >= 34.1 && latitude <= 35.5 && longitude >= 125.0 && longitude <= 127.6) return "전남";
  if (latitude >= 35.0 && latitude <= 35.5 && longitude >= 126.7 && longitude <= 127.4) return "광주";
  if (latitude >= 35.5 && latitude <= 37.0 && longitude >= 127.4 && longitude <= 129.5) return "경북";
  if (latitude >= 34.6 && latitude <= 35.5 && longitude >= 128.5 && longitude <= 129.4) return "대구";
  if (latitude >= 34.5 && latitude <= 35.9 && longitude >= 127.7 && longitude <= 129.5) return "경남";
  if (latitude >= 35.0 && latitude <= 35.5 && longitude >= 128.8 && longitude <= 129.5) return "부산";
  if (latitude >= 35.3 && latitude <= 36.0 && longitude >= 129.0 && longitude <= 129.6) return "울산";
  if (latitude < 34.9) return "제주";
  return "전국";
}

function airQualityLabel(khai) { return khai <= 50 ? "좋음" : khai <= 100 ? "보통" : khai <= 250 ? "나쁨" : "매우 나쁨"; }

async function getAirQuality(latitude, longitude) {
  if (!process.env.AIRKOREA_SERVICE_KEY) return null;
  const params = new URLSearchParams({ serviceKey: process.env.AIRKOREA_SERVICE_KEY, returnType: "json", numOfRows: "100", pageNo: "1", sidoName: provinceFor(latitude, longitude), ver: "1.4" });
  const response = await fetch(`${AIRKOREA_BASE}?${params}`);
  const json = await response.json();
  const item = json?.response?.body?.items?.find((entry) => entry.pm10Value && entry.pm10Value !== "-");
  if (!response.ok || !item) throw new Error(json?.response?.header?.resultMsg || "에어코리아 대기질 응답을 읽을 수 없습니다.");
  const pm10 = Number(item.pm10Value), khai = Number(item.khaiValue);
  return { current: { pm10, european_aqi: Number.isFinite(khai) ? khai : pm10 }, station: item.stationName, label: Number.isFinite(khai) ? airQualityLabel(khai) : (pm10 <= 30 ? "좋음" : pm10 <= 80 ? "보통" : "나쁨") };
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
    const responseText = await response.text();
    let json;
    try { json = JSON.parse(responseText); }
    catch { throw new Error("기상청이 JSON 대신 오류 페이지를 반환했습니다. serviceKey가 디코딩 인증키인지 확인해 주세요."); }
    const items = json?.response?.body?.items?.item;
    if (!response.ok || !Array.isArray(items)) throw new Error(json?.response?.header?.resultMsg || json?.resultMsg || json?.errMsg || "기상청 응답을 읽을 수 없습니다. 공공데이터포털에서 단기예보 API 활용 신청 상태를 확인해 주세요.");
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
    const air = await getAirQuality(latitude, longitude).catch((error) => { console.error("AirKorea request failed:", error.message); return null; });
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" }, body: JSON.stringify({ timezone: "Asia/Seoul", current: { temperature_2m: Number(current.TMP), relative_humidity_2m: Number(current.REH), apparent_temperature: Number(current.TMP), weather_code: wmoCode(current.SKY, current.PTY), wind_speed_10m: Number(current.WSD) * 3.6, uv_index: null }, hourly: { time: hourly.map((entry) => entry.time), temperature_2m: hourly.map((entry) => entry.temperature_2m), weather_code: hourly.map((entry) => entry.weather_code) }, daily: { time: days.map((entry) => `${entry.date.slice(0, 4)}-${entry.date.slice(4, 6)}-${entry.date.slice(6)}`), temperature_2m_max: days.map((entry) => entry.temperature_2m_max), temperature_2m_min: days.map((entry) => entry.temperature_2m_min), weather_code: days.map((entry) => entry.weather_code) }, air, source: "기상청 단기예보" }) };
  } catch (error) { console.error("KMA weather request failed:", error.message); return { statusCode: 502, body: JSON.stringify({ message: error.message || "기상청 API 호출에 실패했습니다." }) }; }
};

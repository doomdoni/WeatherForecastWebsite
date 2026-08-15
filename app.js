const state = { location: { name: "서울특별시", latitude: 37.5665, longitude: 126.978 }, unit: "celsius", weather: null, shownHours: 6 };
const $ = (selector) => document.querySelector(selector);

const condition = (code) => {
  const map = { 0:["맑음","☀"], 1:["대체로 맑음","🌤"], 2:["구름 조금","⛅"], 3:["흐림","☁"], 45:["안개","🌫"], 48:["안개","🌫"], 51:["이슬비","🌦"], 53:["이슬비","🌦"], 55:["이슬비","🌦"], 61:["비","🌧"], 63:["비","🌧"], 65:["강한 비","🌧"], 71:["눈","🌨"], 73:["눈","🌨"], 75:["강한 눈","🌨"], 80:["소나기","🌦"], 81:["소나기","🌧"], 82:["강한 소나기","🌧"], 95:["뇌우","⛈"], 96:["뇌우","⛈"], 99:["뇌우","⛈"] };
  return map[code] || ["알 수 없음", "☁"];
};
const temperature = (value) => state.unit === "fahrenheit" ? `${Math.round(value * 9 / 5 + 32)}°` : `${Math.round(value)}°`;
const aqiInfo = (aqi) => aqi <= 20 ? ["좋음", "☺", "창문을 열고 환기해도 좋아요."] : aqi <= 40 ? ["보통", "●", "가벼운 야외 활동에 좋아요."] : aqi <= 60 ? ["나쁨", "●", "민감한 분은 야외 활동을 줄여 주세요."] : ["매우 나쁨", "●", "가급적 실내 활동을 권장해요."];
const hexToRgb = (hex) => hex.match(/\w\w/g).map((value) => parseInt(value, 16));
const mixColor = (first, second, amount) => `#${hexToRgb(first).map((value, index) => Math.round(value + (hexToRgb(second)[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
const skyStops = [
  { hour: 0, start: "#09142f", end: "#243862" }, { hour: 5, start: "#152852", end: "#805f91" },
  { hour: 7, start: "#e58265", end: "#ffd494" }, { hour: 9, start: "#5da8dd", end: "#c4e6f4" },
  { hour: 16, start: "#3f91d0", end: "#bde1ee" }, { hour: 18.5, start: "#ee9859", end: "#ffe1a3" },
  { hour: 20, start: "#3d487c", end: "#bb7190" }, { hour: 22, start: "#13234c", end: "#2e3d68" }, { hour: 24, start: "#09142f", end: "#243862" }
];

function createStars() {
  const stars = $("#stars");
  stars.replaceChildren();
  for (let index = 0; index < 46; index += 1) {
    const star = document.createElement("i");
    star.className = "star";
    star.style.left = `${Math.random() * 98}%`;
    star.style.top = `${Math.random() * 72}%`;
    star.style.setProperty("--size", `${1 + Math.random() * 3.5}px`);
    star.style.setProperty("--duration", `${.7 + Math.random() * 3.7}s`);
    star.style.setProperty("--delay", `${-Math.random() * 4}s`);
    stars.append(star);
  }
}

function applyWeatherEffect(code) {
  const effects = $("#weatherEffects");
  let type = "";
  if ([95, 96, 99].includes(code)) type = "thunder";
  else if ([45, 48].includes(code)) type = "fog";
  else if ([71, 73, 75, 77, 85, 86].includes(code)) type = "snow";
  else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) type = "rain";
  if (effects.dataset.type === type) return;
  effects.dataset.type = type;
  effects.replaceChildren();
  effects.classList.toggle("has-effect", Boolean(type));
  const count = type === "rain" || type === "thunder" ? 58 : type === "snow" ? 36 : type === "fog" ? 4 : 0;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    particle.className = type === "rain" || type === "thunder" ? "drop" : type === "snow" ? "flake" : "fog-bank";
    particle.style.left = type === "fog" ? `${-18 + Math.random() * 20}%` : `${Math.random() * 100}%`;
    particle.style.top = type === "fog" ? `${8 + index * 21}%` : "";
    particle.style.setProperty("--duration", `${type === "fog" ? 6 + Math.random() * 8 : 1.1 + Math.random() * 2.1}s`);
    particle.style.setProperty("--delay", `${-Math.random() * 5}s`);
    particle.style.setProperty("--drift", `${type === "rain" ? -40 + Math.random() * 65 : -55 + Math.random() * 110}px`);
    if (type === "rain" || type === "thunder") particle.style.setProperty("--length", `${11 + Math.random() * 19}px`);
    if (type === "snow") { particle.textContent = "•"; particle.style.setProperty("--size", `${7 + Math.random() * 12}px`); }
    effects.append(particle);
  }
  if (type === "thunder") { const flash = document.createElement("i"); flash.className = "lightning"; flash.style.setProperty("--duration", "7s"); flash.style.setProperty("--delay", "-2s"); effects.append(flash); }
}

function updateSky() {
  const timezone = state.weather?.timezone || "Asia/Seoul";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour").value) + Number(parts.find((part) => part.type === "minute").value) / 60;
  const nextIndex = skyStops.findIndex((stop) => stop.hour >= hour);
  const next = skyStops[nextIndex], previous = skyStops[Math.max(0, nextIndex - 1)];
  const amount = (hour - previous.hour) / (next.hour - previous.hour || 1);
  const hero = $("#heroPanel");
  hero.style.setProperty("--sky-start", mixColor(previous.start, next.start, amount));
  hero.style.setProperty("--sky-end", mixColor(previous.end, next.end, amount));
  hero.style.setProperty("--sky-angle", `${135 + hour / 24 * 360}deg`);
  hero.classList.toggle("is-night", hour >= 20 || hour < 5.5);
}

async function loadWeather() {
  const { latitude, longitude } = state.location;
  const weatherResponse = await fetch(`/.netlify/functions/weather?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
  const responseText = await weatherResponse.text();
  let weather;
  try { weather = JSON.parse(responseText); }
  catch { throw new Error("Netlify weather 함수가 배포되지 않았습니다. GitHub에 netlify/functions/weather.js가 있는지 확인해 주세요."); }
  if (!weatherResponse.ok) throw new Error(weather.message || "날씨 정보를 불러오지 못했습니다.");
  state.weather = weather;
  render();
}

function render() {
  const { current, hourly, daily, air } = state.weather;
  const [label] = condition(current.weather_code);
  $("#currentDate").textContent = new Intl.DateTimeFormat("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(new Date());
  $("#weatherLabel").textContent = label;
  applyWeatherEffect(current.weather_code);
  $("#currentTemperature").innerHTML = `${temperature(current.temperature_2m).replace("°", "")}<span>°</span>`;
  $("#feelsLike").textContent = temperature(current.apparent_temperature);
  $("#humidity").textContent = `${Math.round(current.relative_humidity_2m)}%`;
  $("#windSpeed").textContent = `${(current.wind_speed_10m / 3.6).toFixed(1)} m/s`;
  $("#uvIndex").textContent = current.uv_index === null ? "기상청 제공 없음" : current.uv_index < 3 ? "낮음" : current.uv_index < 6 ? "보통" : current.uv_index < 8 ? "높음" : "매우 높음";
  $("#heroMessage").textContent = current.weather_code <= 2 ? "오늘은 산책하기 좋은 날이에요." : "외출 전 날씨를 한 번 더 확인하세요.";
  $("#locationButton").innerHTML = `${state.location.name} <span>⌄</span>`;
  const detail = $("#locationDetail");
  if (state.location.detail) { detail.textContent = state.location.detail; detail.hidden = false; } else { detail.hidden = true; }
  const nowIndex = hourly.time.findIndex((time) => new Date(time) >= new Date());
  const start = Math.max(0, nowIndex === -1 ? 0 : nowIndex);
  $("#hourlyList").innerHTML = hourly.time.slice(start, start + state.shownHours).map((time, index) => {
    const actual = start + index, [, icon] = condition(hourly.weather_code[actual]);
    const hour = new Intl.DateTimeFormat("ko-KR", { hour:"numeric", hour12:false }).format(new Date(time));
    return `<article class="hour ${index === 0 ? "active" : ""}"><time>${index === 0 ? "지금" : hour}</time><span class="weather-icon">${icon}</span><strong>${temperature(hourly.temperature_2m[actual])}</strong></article>`;
  }).join("");
  $("#showMoreButton").textContent = state.shownHours >= 24 ? "접기 ↑" : "전체 보기 →";
  $("#weekList").innerHTML = daily.time.slice(0, 7).map((date, index) => {
    const [name, icon] = condition(daily.weather_code[index]);
    const day = index === 0 ? "오늘" : new Intl.DateTimeFormat("ko-KR", { weekday:"short" }).format(new Date(`${date}T00:00:00`));
    return `<div><span>${day}</span><span class="mini-weather">${icon}</span><b>${name}</b><span><strong>${temperature(daily.temperature_2m_max[index])}</strong> <em>${temperature(daily.temperature_2m_min[index])}</em></span></div>`;
  }).join("");
  if (air?.current) { const [airLabel, face, note] = aqiInfo(air.current.european_aqi); $("#airLabel").textContent = airLabel; $("#airFace").textContent = face; $("#pm10").textContent = `${Math.round(air.current.pm10)} ㎍/m³`; $("#airNote").textContent = note; }
  else { $("#airLabel").textContent = "별도 API 필요"; $("#airFace").textContent = "–"; $("#pm10").textContent = "기상청 제공 없음"; $("#airNote").textContent = "대기질은 에어코리아 API를 연결하면 표시할 수 있어요."; }
  updateSky();
}

let searchTimer;
$("#citySearch").addEventListener("input", (event) => {
  clearTimeout(searchTimer); const query = event.target.value.trim(); const results = $("#searchResults");
  if (query.length < 2) { results.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    try { const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ko&countryCode=KR&format=json`); const { results: cities = [] } = await response.json(); results.innerHTML = cities.map((city, index) => `<button data-index="${index}"><strong>${city.name}</strong><span>${[city.admin1, city.country].filter(Boolean).join(", ")}</span></button>`).join("") || "<p>국내 검색 결과가 없어요.</p>"; results._cities = cities; results.hidden = false; } catch { results.innerHTML = "<p>도시 검색에 실패했어요.</p>"; results.hidden = false; }
  }, 250);
});
$("#searchResults").addEventListener("click", async (event) => { const item = event.target.closest("button"); if (!item) return; const city = $("#searchResults")._cities[Number(item.dataset.index)]; state.location = { name: city.name, latitude: city.latitude, longitude: city.longitude }; $("#citySearch").value = ""; $("#searchResults").hidden = true; await safelyLoad(); });
$("#showMoreButton").addEventListener("click", () => { state.shownHours = state.shownHours >= 24 ? 6 : 24; render(); });
$("#settingsButton").addEventListener("click", () => { state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius"; $("#settingsButton").textContent = state.unit === "celsius" ? "°C" : "°F"; render(); });
async function nameCurrentLocation(latitude, longitude, accuracy) {
  const coordinates = `위도 ${latitude.toFixed(5)} · 경도 ${longitude.toFixed(5)} · 정확도 ±${Math.round(accuracy)}m`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ko`);
    if (!response.ok) throw new Error();
    const place = await response.json();
    const address = place.address || {};
    const shortName = [address.city || address.town || address.village || address.municipality || address.county, address.suburb || address.neighbourhood || address.quarter].filter(Boolean).join(" ");
    return { name: shortName || "현재 위치", detail: `${place.display_name || "현재 위치"} · ${coordinates} · OpenStreetMap` };
  } catch { return { name: "현재 위치", detail: coordinates }; }
}
$("#locationButton").addEventListener("click", () => { if (!navigator.geolocation) return alert("이 브라우저에서는 위치 기능을 지원하지 않습니다."); navigator.geolocation.getCurrentPosition(async ({ coords }) => { const namedPlace = await nameCurrentLocation(coords.latitude, coords.longitude, coords.accuracy); state.location = { ...namedPlace, latitude:coords.latitude, longitude:coords.longitude }; await safelyLoad(); }, () => alert("위치 권한이 필요합니다. 도시 검색을 이용해 주세요."), { enableHighAccuracy:true, maximumAge:0, timeout:15000 }); });
async function safelyLoad() { try { $("#heroMessage").textContent = "최신 날씨 정보를 불러오는 중이에요."; await loadWeather(); } catch (error) { $("#heroMessage").textContent = error.message; } }
safelyLoad();
createStars();
setInterval(updateSky, 60_000);

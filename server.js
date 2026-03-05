const express = require("express");
const axios = require("axios");
const session = require("express-session");
const bcrypt = require("bcrypt");
require("dotenv").config();

const { createUser, findUserByEmail } = require("./models/userModel");
const { saveWeather, getUserHistory, getAllUsersWithStats } = require("./models/weatherModel");

const app = express();
const PORT = 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;

// ─── ADMIN CREDENTIALS ───────────────────────────────────────
const ADMIN_NAME  = "AhmadButt97";
const ADMIN_EMAIL = "ahmadbutt@gmail.com";
const ADMIN_PASS  = "butt123"; // change this to something strong

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

app.use(session({
  secret: "weather-secret",
  resave: false,
  saveUninitialized: false
}));

// ─── AUTH GUARDS ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect("/admin/login");
}

// ─── HELPERS ─────────────────────────────────────────────────
const cache = {};

const weatherEmojis = {
  'clear': '☀️', 'sunny': '☀️',
  'clouds': '☁️', 'cloudy': '☁️', 'overcast': '☁️',
  'rain': '🌧️', 'drizzle': '🌦️', 'shower': '🌦️',
  'thunderstorm': '⛈️', 'thunder': '⛈️',
  'snow': '❄️', 'snowfall': '❄️', 'blizzard': '❄️',
  'mist': '🌫️', 'fog': '🌁', 'haze': '😶‍🌫️',
  'tornado': '🌪️', 'sand': '🌪️', 'dust': '💨',
  'smoke': '💨'
};

function getWeatherEmoji(description) {
  const desc = description.toLowerCase();
  for (const [key, emoji] of Object.entries(weatherEmojis)) {
    if (desc.includes(key)) return emoji;
  }
  return '🌡️';
}

function generateWeatherPrediction(weatherData) {
  const temp = weatherData.temp;
  const condition = weatherData.desc.toLowerCase();
  const humidity = weatherData.humidity;
  const windSpeed = weatherData.wind_speed;

  let prediction = '';
  if (temp > 35) prediction = '🥵 Extreme heat warning! Stay indoors and drink plenty of water. ';
  else if (temp > 30) prediction = '🔥 Very hot day. Perfect for swimming or staying in AC. ';
  else if (temp > 25) prediction = '😎 Warm and pleasant. Great for outdoor activities! ';
  else if (temp > 20) prediction = '😊 Perfect weather for a walk or picnic. ';
  else if (temp > 15) prediction = '🧥 Cool but comfortable. A light jacket would be nice. ';
  else if (temp > 10) prediction = '❄️ Chilly weather. Time for warm drinks. ';
  else if (temp > 0) prediction = '🥶 Cold day. Bundle up with warm clothes. ';
  else prediction = '🧊 Freezing temperatures! Stay indoors if possible. ';

  if (condition.includes('rain')) prediction += '🌧️ Don\'t forget your umbrella! ';
  else if (condition.includes('thunder')) prediction += '⚡ Avoid outdoor activities during thunderstorms. ';
  else if (condition.includes('snow')) prediction += '❄️ Be careful on slippery roads. ';
  else if (condition.includes('wind') || windSpeed > 15) prediction += '💨 It\'s windy outside. Secure loose objects. ';

  if (humidity > 80) prediction += '💦 Very humid. Stay hydrated!';
  else if (humidity < 30) prediction += '🏜️ Dry air. Use moisturizer.';

  return prediction;
}

function getTemperatureFeeling(temp) {
  if (temp > 35) return '🥵 Extreme Heat';
  if (temp > 30) return '🔥 Very Hot';
  if (temp > 25) return '😎 Warm';
  if (temp > 20) return '😊 Pleasant';
  if (temp > 15) return '🧥 Cool';
  if (temp > 10) return '❄️ Chilly';
  if (temp > 5) return '🥶 Cold';
  if (temp > 0) return '🧊 Very Cold';
  return '⛄ Freezing';
}

async function generateHourlyForecast(city, currentTemp) {
  try {
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
    const response = await axios.get(forecastUrl);
    return response.data.list.slice(0, 7).map((item, index) => ({
      time: index === 0 ? 'Now' : `${index * 3}h`,
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon,
      condition: item.weather[0].description,
      emoji: getWeatherEmoji(item.weather[0].description)
    }));
  } catch {
    return ['Now', '1h', '2h', '3h', '4h', '5h', '6h'].map(hour => ({
      time: hour, temp: currentTemp, icon: '01d', condition: 'Clear', emoji: '☀️'
    }));
  }
}

// ════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.render("index", {
    weather: null, forecast: null, error: null,
    city: '', emoji: '🌡️',
    prediction: 'Enter a city to get real-time weather data!',
    feeling: '', userName: req.session.userName
  });
});

app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("login", { error: null });
});

app.get("/signup", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await findUserByEmail(email);
    if (existing) return res.render("signup", { error: "Email already registered. Please log in." });
    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser(name, email, hashedPassword);
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.render("signup", { error: "Something went wrong. Please try again." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) return res.render("login", { error: "No account found with that email." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { error: "Incorrect password. Please try again." });
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.render("login", { error: "Something went wrong. Please try again." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ════════════════════════════════════════════════════════════
// PROTECTED USER ROUTES
// ════════════════════════════════════════════════════════════

app.post("/", requireAuth, async (req, res) => {
  try {
    const city = req.body.city?.trim();
    if (!city) {
      return res.render("index", {
        weather: null, forecast: null,
        error: 'Please enter a city name',
        city: '', emoji: '❓',
        prediction: 'City name is required!',
        feeling: '', userName: req.session.userName
      });
    }

    if (!API_KEY) throw new Error('Please add OPENWEATHER_API_KEY to your .env file');

    const cacheKey = city.toLowerCase();
    const cachedData = cache[cacheKey];
    if (cachedData && (Date.now() - cachedData.timestamp < 600000)) {
      return res.render("index", { ...cachedData.data, city, userName: req.session.userName });
    }

    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
    const response = await axios.get(apiUrl);
    const weatherData = response.data;

    const weather = {
      city: weatherData.name,
      temp: Math.round(weatherData.main.temp),
      feels_like: Math.round(weatherData.main.feels_like),
      humidity: weatherData.main.humidity,
      desc: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      wind_speed: Math.round(weatherData.wind.speed * 3.6),
      pressure: weatherData.main.pressure,
      country: weatherData.sys.country,
      sunrise: new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString(),
      sunset: new Date(weatherData.sys.sunset * 1000).toLocaleTimeString(),
    };

    const emoji = getWeatherEmoji(weather.desc);
    const prediction = generateWeatherPrediction(weather);
    const feeling = getTemperatureFeeling(weather.temp);
    const forecast = await generateHourlyForecast(city, weather.temp);

    await saveWeather(req.session.userId, weather.city, weather.temp);

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: { weather, forecast, error: null, emoji, prediction, feeling }
    };

    const now = Date.now();
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > 3600000) delete cache[key];
    });

    res.render("index", { weather, forecast, error: null, city, emoji, prediction, feeling, userName: req.session.userName });

  } catch (error) {
    console.error('❌ Error:', error.message);
    let errorMessage = 'Unable to fetch weather data. Please try again.';
    if (error.response?.status === 404) errorMessage = `City "${req.body.city || ''}" not found.`;
    else if (error.response?.status === 401) errorMessage = 'Invalid API key. Check your .env file.';
    else if (error.code === 'ENOTFOUND') errorMessage = 'Network error. Check your internet connection.';

    res.render("index", {
      weather: null, forecast: null, error: errorMessage,
      city: req.body.city || '', emoji: '😢',
      prediction: 'Could not fetch weather data.',
      feeling: '', userName: req.session.userName
    });
  }
});

app.get("/history", requireAuth, async (req, res) => {
  const history = await getUserHistory(req.session.userId);
  const total = history.length;
  const cityCount = {};
  history.forEach(h => { cityCount[h.city] = (cityCount[h.city] || 0) + 1; });
  const topCity = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a])[0] || '—';
  const temps = history.map(h => Number(h.temperature));
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const minTemp = temps.length ? Math.min(...temps) : null;
  res.render("history", { history, userName: req.session.userName, total, topCity, maxTemp, minTemp });
});

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════════════════════════

// Admin Login Page
app.get("/admin/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("admin-login", { error: null });
});

// Admin Login POST
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    req.session.adminName = ADMIN_NAME;
    return res.redirect("/admin");
  }
  res.render("admin-login", { error: "Invalid admin credentials." });
});

// Admin Logout
app.get("/admin/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

// Admin Dashboard
app.get("/admin", requireAdmin, async (req, res) => {
  const users = await getAllUsersWithStats();
  const totalUsers    = users.length;
  const totalSearches = users.reduce((sum, u) => sum + Number(u.search_count), 0);
  const mostActive    = users.sort((a, b) => Number(b.search_count) - Number(a.search_count))[0] || null;
  res.render("admin", { adminName: ADMIN_NAME, users, totalUsers, totalSearches, mostActive });
});

// Admin — view a specific user's history
app.get("/admin/user/:id", requireAdmin, async (req, res) => {
  const history = await getUserHistory(req.params.id);
  const total   = history.length;
  const cityCount = {};
  history.forEach(h => { cityCount[h.city] = (cityCount[h.city] || 0) + 1; });
  const topCity  = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a])[0] || '—';
  const temps    = history.map(h => Number(h.temperature));
  const maxTemp  = temps.length ? Math.max(...temps) : null;
  const minTemp  = temps.length ? Math.min(...temps) : null;
  const userName = history[0]?.user_name || 'User';
  res.render("admin-user-history", { history, userName, total, topCity, maxTemp, minTemp, adminName: ADMIN_NAME });
});

// ─── START ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║               🌤️ REAL-TIME WEATHER APP                  ║
  ╠══════════════════════════════════════════════════════════╣
  ║ 🌐 App:    http://localhost:${PORT}                         ║
  ║ 🔐 Admin:  http://localhost:${PORT}/admin/login             ║
  ║ 🔑 API Key: ${API_KEY ? 'Configured ✓' : 'Missing ✗'}                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

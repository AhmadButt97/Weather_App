# WeatherHub Pro - Setup Guide 🌤️

## Important: Configure Your API Key ⚠️

Before running the app, you must add your own OpenWeather API key.

### Step 1: Get a Free API Key
1. Go to [OpenWeatherMap API](https://openweathermap.org/api)
2. Click "Sign Up" and create a free account
3. Once logged in, go to your API keys page
4. Copy your API key

### Step 2: Configure the API Key
1. Open the `.env` file in the project root
2. Replace `YOUR_API_KEY_HERE` with your actual API key:
   ```
   PORT=3000
   OPENWEATHER_API_KEY=your_actual_api_key_here
   ```
3. Save the file

### Step 3: Install & Run
```bash
npm install
npm start
```

Visit **http://localhost:3000** in your browser.

## Features 🎯

✨ Beautiful, responsive weather app  
🌍 Search any city worldwide  
📱 Mobile-optimized design  
💡 Smart weather insights  
📊 24-hour forecast  
🇵🇰 Quick Pakistani cities  

## Troubleshooting 🔧

**"Invalid API key" error?**
- Make sure you added a valid API key to .env
- Check that there are no extra spaces in the API key
- Restart the server after changing .env

**"City not found"?**
- Check the city name spelling
- Use English city names only

**Port 3000 already in use?**
- Change PORT in .env file to another number (e.g., 3001)

---

Enjoy your weather app! 🌤️

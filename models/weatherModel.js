const pool = require("../config/db");

// Save a weather search for a user
async function saveWeather(userId, city, temperature) {
  await pool.query(
    "INSERT INTO weather_history (user_id, city, temperature) VALUES (?, ?, ?)",
    [userId, city, temperature]
  );
}

// Get search history for a specific user
async function getUserHistory(userId) {
  const [rows] = await pool.query(
    `SELECT wh.*, u.name AS user_name
     FROM weather_history wh
     JOIN users u ON wh.user_id = u.id
     WHERE wh.user_id = ?
     ORDER BY wh.searched_at DESC`,
    [userId]
  );
  return rows;
}

// Admin: get all users with their search stats
async function getAllUsersWithStats() {
  const [rows] = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      COUNT(wh.id)        AS search_count,
      MAX(wh.searched_at) AS last_search,
      MAX(wh.temperature) AS hottest,
      MIN(wh.temperature) AS coldest
    FROM users u
    LEFT JOIN weather_history wh ON u.id = wh.user_id
    GROUP BY u.id, u.name, u.email
    ORDER BY search_count DESC
  `);
  return rows;
}

module.exports = { saveWeather, getUserHistory, getAllUsersWithStats };

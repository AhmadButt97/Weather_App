const pool = require("../config/db");

// Create a new user
async function createUser(name, email, password) {
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, password]
  );
  return result;
}

// Find a user by email
async function findUserByEmail(email) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

module.exports = { createUser, findUserByEmail };

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require("pg");
const { Resend } = require('resend');
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ----------------------------------
// 🗄 PostgreSQL (avis)
// ----------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      rating INT NOT NULL,
      message TEXT NOT NULL,
      delete_token TEXT,
      date TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("Table reviews OK");
}
initDB();

// ----------------------------------
// ✉️ Resend
// ----------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

// Anti-spam contact
let lastSendTimes = {};

app.get("/", (req, res) => {
  res.send("Backend opérationnel 👍");
});

// ----------------------------------
// 📩 FORMULAIRE CONTACT
// ----------------------------------
app.post('/contact', async (req, res) => {
  const { name, email, title, message, website } = req.body;

  if (website && website.trim() !== "") return res.json({ success: true });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (lastSendTimes[ip] && Date.now() - lastSendTimes[ip] < 30000) {
    return res.json({ success: true });
  }
  lastSendTimes[ip] = Date.now();

  if (!name || !email || !title || !message)
    return res.status(400).json({ success: false });

  try {
    await resend.emails.send({
      from: "Site Freelance <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      reply_to: email,
      subject: title,
      text: `Nom: ${name}\nEmail: ${email}\nMessage:\n${message}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ⭐ AJOUTER AVIS
// ----------------------------------
app.post("/reviews", async (req, res) => {
  const { name, rating, message } = req.body;

  if (!name || !rating || !message)
    return res.status(400).json({ success: false });

  const delete_token = uuidv4(); // token unique pour suppression

  try {
    const result = await pool.query(
      "INSERT INTO reviews (name, rating, message, delete_token) VALUES ($1,$2,$3,$4) RETURNING id",
      [name, rating, message, delete_token]
    );

    res.json({
      success: true,
      id: result.rows[0].id,
      delete_token
    });
  } catch (err) {
    console.error("Erreur ajout avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 📥 RÉCUPÉRER AVIS
// ----------------------------------
app.get("/reviews", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM reviews ORDER BY date DESC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ❌ SUPPRIMER AVIS
// ----------------------------------
app.post("/reviews/delete", async (req, res) => {
  const { id, delete_token } = req.body;

  try {
    const result = await pool.query(
      "DELETE FROM reviews WHERE id=$1 AND delete_token=$2",
      [id, delete_token]
    );

    if (result.rowCount === 0)
      return res.json({ success: false });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur opérationnel 🔥");
});



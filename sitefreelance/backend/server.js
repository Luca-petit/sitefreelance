const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crée la table automatiquement
async function createReviewsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        date TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table reviews OK ✔️");
  } catch (err) {
    console.error("Erreur création table :", err);
  }
}

createReviewsTable();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ⚡ Client Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 Anti-spam : limiter une requête toutes les 30 sec par IP
let lastSendTimes = {};

app.get("/", (req, res) => {
  res.send("Backend opérationnel 👍");
});

app.post('/contact', async (req, res) => {
  const { name, email, title, message, website } = req.body;

  // 🔥 Anti-spam 1 : Honeypot (bots remplissent ce champ)
  if (website && website.trim() !== "") {
    console.log("SPAM BLOQUÉ (honeypot)");
    return res.json({ success: true });
  }

  // 🔥 Anti-spam 2 : Envoi trop fréquent par IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (lastSendTimes[ip] && Date.now() - lastSendTimes[ip] < 30000) {
    console.log("SPAM BLOQUÉ (trop de requêtes)");
    return res.json({ success: true });
  }
  lastSendTimes[ip] = Date.now();

  // Champs obligatoires pour humains
  if (!name || !email || !title || !message) {
    return res.status(400).json({ success: false });
  }

  try {
    // Envoi via RESEND
    await resend.emails.send({
      from: "Site Freelance <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      reply_to: email,
      subject: title,
      text: `Nom : ${name}\nEmail : ${email}\n\nMessage :\n${message}`
    });

    res.json({ success: true });

  } catch (err) {
    console.error("ERREUR RESEND :", err);
    res.status(500).json({ success: false });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur opérationnel 🔥");
});


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
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});



// Créer table si manque
async function initDB(retries = 10) {
  while (retries > 0) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          rating INT,
          message TEXT NOT NULL,
          delete_token TEXT,
          date TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log("✅ DB OK");
      return;
    } catch (err) {
      console.log("⚠️ DB not ready, retry...", err.code || err.message);
      retries--;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log("❌ DB unreachable after retries");
}
initDB();



// ----------------------------------
// 🔧 ROUTE TEMPORAIRE POUR FIX DB
// ----------------------------------
app.get("/fixdb", async (req, res) => {
  try {
    await pool.query(`ALTER TABLE reviews ADD COLUMN rating INT;`);
  } catch (e) { console.log("rating déjà existant :", e.message); }

  try {
    await pool.query(`ALTER TABLE reviews ADD COLUMN delete_token TEXT;`);
  } catch (e) { console.log("delete_token déjà existant :", e.message); }

  res.send("✔️ Fix DB exécuté");
});

// ----------------------------------
// ✉️ Resend (contact)
// ----------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

let lastSendTimes = {};

app.get("/", (req, res) => {
  res.send("Backend opérationnel 👍");
});

// ----------------------------------
// 📩 FORMULAIRE CONTACT
// ----------------------------------
app.post('/contact', async (req, res) => {
  const { name, email, title, message, website } = req.body;

  // Anti-spam (honeypot)
  if (website && website.trim() !== "") {
    console.log("SPAM honeypot");
    return res.json({ success: true });
  }

  // Anti-spam IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (lastSendTimes[ip] && Date.now() - lastSendTimes[ip] < 30000) {
    console.log("SPAM fréquence");
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
    console.error("Erreur mail:", err);
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

  const delete_token = uuidv4();

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
    const r = await pool.query(
      "SELECT * FROM reviews ORDER BY date DESC"
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur get avis:", err);
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
    console.error("Erreur delete avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 🔐 ADMIN LOGIN
// ----------------------------------
app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, token: "admin_session_ok" });
  }

  res.json({ success: false });
});

// ----------------------------------
// 📥 ADMIN — GET ALL REVIEWS
// (Protégé)
// ----------------------------------
app.post("/admin/reviews", async (req, res) => {
  if (req.body.token !== "admin_session_ok")
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const r = await pool.query("SELECT * FROM reviews ORDER BY date DESC");
    res.json({ reviews: r.rows });
  } catch (err) {
    res.status(500).json({ error: "Erreur DB" });
  }
});

// ----------------------------------
// ❌ ADMIN — DELETE REVIEW
// ----------------------------------
app.post("/admin/review/delete", async (req, res) => {
  const { id, token } = req.body;

  if (token !== "admin_session_ok")
    return res.status(401).json({ error: "Unauthorized" });

  try {
    await pool.query("DELETE FROM reviews WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression" });
  }
});

app.get("/health/db", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});



app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur opérationnel 🔥");
});

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const { Resend } = require("resend");
const { v4: uuidv4 } = require("uuid");
const dns = require("dns");

// ✅ Force IPv4 first (fix ENETUNREACH sur certains hosts type Render)
dns.setDefaultResultOrder("ipv4first");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ----------------------------------
// 🗄 PostgreSQL (Supabase)
// ----------------------------------
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL manquant dans les variables d'environnement");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
});

// ✅ Ne pas crash si DB down
async function initDB() {
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
    console.log("✅ Table reviews OK");
  } catch (err) {
    console.error("❌ DB init failed:", err.message);
  }
}
initDB();

// ----------------------------------
// ✉️ Resend (contact)
// ----------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);
let lastSendTimes = {};

app.get("/", (req, res) => res.send("Backend opérationnel 👍"));

// ----------------------------------
// 📩 CONTACT
// ----------------------------------
app.post("/contact", async (req, res) => {
  const { name, email, title, message, website } = req.body;

  if (website && website.trim() !== "") return res.json({ success: true });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (lastSendTimes[ip] && Date.now() - lastSendTimes[ip] < 30000) return res.json({ success: true });
  lastSendTimes[ip] = Date.now();

  if (!name || !email || !title || !message) return res.status(400).json({ success: false });

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
  if (!name || !rating || !message) return res.status(400).json({ success: false });

  const delete_token = uuidv4();

  try {
    const result = await pool.query(
      "INSERT INTO reviews (name, rating, message, delete_token) VALUES ($1,$2,$3,$4) RETURNING id",
      [name, rating, message, delete_token]
    );
    res.json({ success: true, id: result.rows[0].id, delete_token });
  } catch (err) {
    console.error("Erreur ajout avis:", err.message);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 📥 GET AVIS
// ----------------------------------
app.get("/reviews", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM reviews ORDER BY date DESC");
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur get avis:", err.message);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ❌ DELETE OWN REVIEW
// ----------------------------------
app.post("/reviews/delete", async (req, res) => {
  const { id, delete_token } = req.body;

  try {
    const result = await pool.query("DELETE FROM reviews WHERE id=$1 AND delete_token=$2", [id, delete_token]);
    if (result.rowCount === 0) return res.json({ success: false });
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur delete avis:", err.message);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 🔐 ADMIN
// ----------------------------------
app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) return res.json({ success: true, token: "admin_session_ok" });
  res.json({ success: false });
});

app.post("/admin/reviews", async (req, res) => {
  if (req.body.token !== "admin_session_ok") return res.status(401).json({ error: "Unauthorized" });

  try {
    const r = await pool.query("SELECT * FROM reviews ORDER BY date DESC");
    res.json({ reviews: r.rows });
  } catch (err) {
    console.error("Erreur admin reviews:", err.message);
    res.status(500).json({ error: "Erreur DB" });
  }
});

app.post("/admin/review/delete", async (req, res) => {
  const { id, token } = req.body;
  if (token !== "admin_session_ok") return res.status(401).json({ error: "Unauthorized" });

  try {
    await pool.query("DELETE FROM reviews WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur admin delete:", err.message);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Serve🔥 Serveur opérationnel"));

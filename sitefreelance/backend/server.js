require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const { Resend } = require("resend");
const { v4: uuidv4 } = require("uuid");

const app = express();

// ✅ CORS (large, simple)
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ----------------------------------
// 🗄 PostgreSQL
// ----------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ helper : détecter si table "avis" existe, sinon "reviews"
async function getReviewsTable() {
  const r = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('avis','reviews')
    ORDER BY CASE WHEN table_name='avis' THEN 0 ELSE 1 END
    LIMIT 1;
  `);
  return r.rows[0]?.table_name || "reviews";
}

// ✅ helper : normaliser champs (FR/EN)
function normalizeRow(row) {
  return {
    id: row.id,
    name: row.name ?? row.nom,
    rating: row.rating ?? row.notation,
    message: row.message,
    delete_token: row.delete_token ?? row.supprimer_jeton,
    date: row.date,
  };
}

// ----------------------------------
// ✉️ Resend
// ----------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);
let lastSendTimes = {};

// ----------------------------------
// ✅ HEALTH
// ----------------------------------
app.get("/", (req, res) => {
  res.send("Backend opérationnel 👍");
});

// ----------------------------------
// 📩 CONTACT
// ----------------------------------
app.post("/contact", async (req, res) => {
  const { name, email, title, message, website } = req.body;

  // honeypot
  if (website && website.trim() !== "") return res.json({ success: true });

  // anti-spam IP 30 sec
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
      text: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
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
  const table = await getReviewsTable();

  try {
    if (table === "avis") {
      // Supabase FR
      const result = await pool.query(
        `INSERT INTO avis (nom, notation, message, supprimer_jeton) VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, Number(rating), message, delete_token]
      );
      return res.json({ success: true, id: result.rows[0].id, delete_token });
    } else {
      // ancien schema EN
      const result = await pool.query(
        `INSERT INTO reviews (name, rating, message, delete_token) VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, Number(rating), message, delete_token]
      );
      return res.json({ success: true, id: result.rows[0].id, delete_token });
    }
  } catch (err) {
    console.error("Erreur ajout avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 📥 GET AVIS
// ----------------------------------
app.get("/reviews", async (req, res) => {
  const table = await getReviewsTable();

  try {
    const r = await pool.query(`SELECT * FROM ${table} ORDER BY date DESC`);
    const rows = r.rows.map(normalizeRow);
    res.json(rows);
  } catch (err) {
    console.error("Erreur get avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ❌ DELETE AVIS USER (token)
// ----------------------------------
app.post("/reviews/delete", async (req, res) => {
  const { id, delete_token } = req.body;
  const table = await getReviewsTable();

  try {
    if (table === "avis") {
      const result = await pool.query(
        `DELETE FROM avis WHERE id=$1 AND supprimer_jeton=$2`,
        [id, delete_token]
      );
      return res.json({ success: result.rowCount > 0 });
    } else {
      const result = await pool.query(
        `DELETE FROM reviews WHERE id=$1 AND delete_token=$2`,
        [id, delete_token]
      );
      return res.json({ success: result.rowCount > 0 });
    }
  } catch (err) {
    console.error("Erreur delete avis:", err);
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

  const table = await getReviewsTable();
  try {
    const r = await pool.query(`SELECT * FROM ${table} ORDER BY date DESC`);
    res.json({ reviews: r.rows.map(normalizeRow) });
  } catch (err) {
    console.error("Erreur admin reviews:", err);
    res.status(500).json({ error: "Erreur DB" });
  }
});

app.post("/admin/review/delete", async (req, res) => {
  const { id, token } = req.body;
  if (token !== "admin_session_ok") return res.status(401).json({ error: "Unauthorized" });

  const table = await getReviewsTable();
  try {
    await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur admin delete:", err);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur opérationnel 🔥");
});

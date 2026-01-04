require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const { Resend } = require("resend");
const { v4: uuidv4 } = require("uuid");

const app = express();
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

// ----------------------------------
// ✅ Detect Supabase schema (avis) or old schema (reviews)
// ----------------------------------
let DB_MODE = "reviews"; // default

async function detectDBMode() {
  try {
    const checkAvis = await pool.query(`
      SELECT to_regclass('public.avis') AS exists
    `);
    if (checkAvis.rows?.[0]?.exists) {
      DB_MODE = "avis";
      console.log("DB mode: avis (Supabase)");
      return;
    }
  } catch (e) {
    // ignore
  }

  DB_MODE = "reviews";
  console.log("DB mode: reviews (legacy)");
}

function mapRow(row) {
  // Always return normalized shape
  return {
    id: row.id,
    name: row.name ?? row.nom ?? "",
    rating: Number(row.rating ?? row.notation ?? 0),
    message: row.message ?? row.message ?? "",
    date: row.date ?? row.date ?? null,
    delete_token: row.delete_token ?? row.supprimer_jeton ?? null,
  };
}

// ----------------------------------
// ✅ Init DB (create the right table if missing)
// ----------------------------------
async function initDB() {
  await detectDBMode();

  if (DB_MODE === "avis") {
    // Supabase schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avis (
        id SERIAL PRIMARY KEY,
        nom TEXT NOT NULL,
        notation INT NOT NULL,
        message TEXT NOT NULL,
        supprimer_jeton TEXT,
        date TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table avis OK");
  } else {
    // Legacy schema
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
}
initDB().catch(err => console.error("Init DB error:", err));

// ----------------------------------
// 🔧 OPTIONAL FIX ROUTE (legacy only)
// ----------------------------------
app.get("/fixdb", async (req, res) => {
  if (DB_MODE !== "reviews") return res.send("DB mode avis: fixdb not needed.");

  try {
    await pool.query(`ALTER TABLE reviews ADD COLUMN rating INT;`);
  } catch (e) {}

  try {
    await pool.query(`ALTER TABLE reviews ADD COLUMN delete_token TEXT;`);
  } catch (e) {}

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
// 📩 CONTACT
// ----------------------------------
app.post("/contact", async (req, res) => {
  const { name, email, title, message, website } = req.body;

  // honeypot
  if (website && website.trim() !== "") return res.json({ success: true });

  // anti-spam by IP
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (lastSendTimes[ip] && Date.now() - lastSendTimes[ip] < 30000) {
    return res.json({ success: true });
  }
  lastSendTimes[ip] = Date.now();

  if (!name || !email || !title || !message) {
    return res.status(400).json({ success: false });
  }

  try {
    await resend.emails.send({
      from: "Site Freelance <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      reply_to: email,
      subject: title,
      text: `Nom: ${name}\nEmail: ${email}\nMessage:\n${message}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur mail:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ⭐ ADD REVIEW
// ----------------------------------
app.post("/reviews", async (req, res) => {
  const { name, rating, message } = req.body;

  if (!name || !rating || !message)
    return res.status(400).json({ success: false });

  const token = uuidv4();

  try {
    if (DB_MODE === "avis") {
      const result = await pool.query(
        "INSERT INTO avis (nom, notation, message, supprimer_jeton) VALUES ($1,$2,$3,$4) RETURNING id",
        [name, rating, message, token]
      );
      return res.json({ success: true, id: result.rows[0].id, delete_token: token });
    } else {
      const result = await pool.query(
        "INSERT INTO reviews (name, rating, message, delete_token) VALUES ($1,$2,$3,$4) RETURNING id",
        [name, rating, message, token]
      );
      return res.json({ success: true, id: result.rows[0].id, delete_token: token });
    }
  } catch (err) {
    console.error("Erreur ajout avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// 📥 GET REVIEWS
// (Always returns array of normalized rows)
// ----------------------------------
app.get("/reviews", async (req, res) => {
  try {
    const r =
      DB_MODE === "avis"
        ? await pool.query("SELECT * FROM avis ORDER BY date DESC")
        : await pool.query("SELECT * FROM reviews ORDER BY date DESC");

    res.json(r.rows.map(mapRow));
  } catch (err) {
    console.error("Erreur get avis:", err);
    res.status(500).json({ success: false });
  }
});

// ----------------------------------
// ❌ DELETE OWN REVIEW (token)
// ----------------------------------
app.post("/reviews/delete", async (req, res) => {
  const { id, delete_token } = req.body;

  try {
    const result =
      DB_MODE === "avis"
        ? await pool.query(
            "DELETE FROM avis WHERE id=$1 AND supprimer_jeton=$2",
            [id, delete_token]
          )
        : await pool.query(
            "DELETE FROM reviews WHERE id=$1 AND delete_token=$2",
            [id, delete_token]
          );

    if (result.rowCount === 0) return res.json({ success: false });
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

  // ✅ Support both env names (you had ADMIN_PASS + ADMIN_PASSWORD in Render)
  const ADMIN =
    process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || "";

  if (password === ADMIN && ADMIN.length > 0) {
    return res.json({ success: true, token: "admin_session_ok" });
  }

  res.json({ success: false });
});

// ----------------------------------
// 📥 ADMIN — GET ALL REVIEWS
// ----------------------------------
app.post("/admin/reviews", async (req, res) => {
  if (req.body.token !== "admin_session_ok")
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const r =
      DB_MODE === "avis"
        ? await pool.query("SELECT * FROM avis ORDER BY date DESC")
        : await pool.query("SELECT * FROM reviews ORDER BY date DESC");

    // ✅ Always send normalized format
    res.json({ reviews: r.rows.map(mapRow) });
  } catch (err) {
    console.error("Erreur admin reviews:", err);
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
    if (DB_MODE === "avis") {
      await pool.query("DELETE FROM avis WHERE id=$1", [id]);
    } else {
      await pool.query("DELETE FROM reviews WHERE id=$1", [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur suppression admin:", err);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur opérationnel 🔥");
});
